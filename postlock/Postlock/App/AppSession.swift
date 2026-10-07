import Foundation
import Observation

@MainActor
@Observable
final class AppSession {
    private(set) var profile: PostingProfile?
    private(set) var commitment: PostingCommitment?
    private(set) var verifiedCount: Int
    private(set) var developerOverrideBlocked = false
    private(set) var isVerifying = false
    private(set) var verificationMessage: String?
    private(set) var completedGoalDates: Set<String> = []
    private let streakDefaults: UserDefaults

    private let profileStore: any PostingProfileStoring
    private let commitmentStore: any PostingCommitmentStoring
    let profileClient: any PostingProfileClient
    private let verificationClient: any PostVerificationClient
    let screenTime: ScreenTimeService
    let notifications: NotificationService
    private let sharedDefaults = UserDefaults(suiteName: AppGroup.identifier) ?? .standard
    private let lastActiveKey = "lastActiveAt"

    init(
        profileStore: any PostingProfileStoring,
        commitmentStore: any PostingCommitmentStoring,
        profileClient: any PostingProfileClient,
        verificationClient: any PostVerificationClient,
        screenTime: ScreenTimeService,
        notifications: NotificationService? = nil,
        streakDefaults: UserDefaults = .standard
    ) {
        self.profileStore = profileStore
        self.commitmentStore = commitmentStore
        self.profileClient = profileClient
        self.verificationClient = verificationClient
        self.screenTime = screenTime
        self.notifications = notifications ?? NotificationService()
        self.streakDefaults = streakDefaults
        profile = profileStore.load()
        commitment = commitmentStore.load()
        verifiedCount = commitmentStore.loadVerifiedCount()
        completedGoalDates = Set(streakDefaults.stringArray(forKey: streakKey) ?? [])
        if let commitment, commitment.goal > 0, verifiedCount >= commitment.goal,
           let day = commitmentStore.loadVerifiedDate() {
            completedGoalDates.insert(day)
            streakDefaults.set(Array(completedGoalDates), forKey: streakKey)
        }
        if let commitment, commitmentStore.loadVerifiedDate() != Self.localDate(for: commitment) {
            verifiedCount = 0
            commitmentStore.saveVerifiedCount(0)
            commitmentStore.saveVerifiedDate(Self.localDate(for: commitment))
        }
        self.notifications.onPreferencesChanged = { [weak self] in self?.refreshReminders() }
        self.notifications.onVerifyRequested = { [weak self] in await self?.verifyFromNotification() }
    }

    var hasPostingProfile: Bool { profile != nil }
    var hasCommitment: Bool { commitment != nil }

    func save(_ profile: PostingProfile) {
        self.profile = profile
        profileStore.save(profile)
        completedGoalDates = Set(streakDefaults.stringArray(forKey: streakKey) ?? [])
        refreshReminders()
    }

    func save(_ commitment: PostingCommitment) {
        self.commitment = commitment
        commitmentStore.save(commitment)
        verifiedCount = 0
        commitmentStore.saveVerifiedCount(0)
        commitmentStore.saveVerifiedDate(Self.localDate(for: commitment))
        screenTime.schedule(commitment: commitment, verifiedCount: 0)
        refreshReminders()
    }

    /// Saves the plan, starts enforcement, and asks for reminder permission.
    func activate(_ commitment: PostingCommitment) {
        save(commitment)
        reconcileEnforcement()
        Task {
            await notifications.requestAuthorization()
            refreshReminders()
        }
    }

    func setVerifiedCount(_ count: Int) {
        verifiedCount = max(0, min(count, commitment?.goal ?? count))
        commitmentStore.saveVerifiedCount(verifiedCount)
        if let commitment {
            commitmentStore.saveVerifiedDate(Self.localDate(for: commitment))
            if commitment.goal > 0, verifiedCount >= commitment.goal,
               PostingStateCalculator.state(for: commitment, verifiedCount: verifiedCount, now: .now).status == .completed {
                completedGoalDates.insert(Self.localDate(for: commitment))
                streakDefaults.set(Array(completedGoalDates), forKey: streakKey)
            }
            screenTime.updateVerifiedCount(verifiedCount, commitment: commitment)
        }
        reconcileEnforcement()
        refreshReminders()
    }

    private var streakKey: String { "postingStreakDays.\(profile?.username.lowercased() ?? "anonymous")" }

    func completedGoal(on date: Date) -> Bool {
        guard let commitment else { return false }
        return completedGoalDates.contains(Self.localDate(for: commitment, now: date))
    }

    func currentStreak(now: Date = .now) -> Int {
        guard let commitment else { return 0 }
        return PostingStreakCalculator.count(completedDates: completedGoalDates, commitment: commitment, now: now)
    }

    func reconcileEnforcement(now: Date = .now) {
        guard let commitment else { return }
        screenTime.refreshAuthorization()
        let today = Self.localDate(for: commitment, now: now)
        var remindersChanged = false
        if commitmentStore.loadVerifiedDate() != today {
            remindersChanged = true
            verifiedCount = 0
            verificationMessage = nil
            developerOverrideBlocked = false
            commitmentStore.saveVerifiedCount(0)
            commitmentStore.saveVerifiedDate(today)
            screenTime.updateVerifiedCount(0, commitment: commitment)
        }
        if developerOverrideBlocked {
            screenTime.setShielding(active: true)
            return
        }
        let state = PostingStateCalculator.state(for: commitment, verifiedCount: verifiedCount, now: now)
        screenTime.setShielding(active: state.shouldBlock)
        if state.shouldBlock {
            remindersChanged = DeadlineMissLog.record(
                day: today,
                sequences: (verifiedCount + 1) ... state.passedDeadlineCount,
                calendar: ReminderPlanner.calendar(for: commitment),
                now: now,
                in: sharedDefaults
            ) || remindersChanged
        }
        if remindersChanged { refreshReminders(now: now) }
    }

    /// Rebuilds pending reminders from current state. Cheap and idempotent, so
    /// call it after anything that changes what the user owes today.
    func refreshReminders(now: Date = .now) {
        guard let commitment else {
            notifications.apply([], today: "", verifiedCount: 0)
            return
        }
        let lastActive = sharedDefaults.object(forKey: lastActiveKey) as? Date ?? now
        let plan = ReminderPlanner.plan(.init(
            commitment: commitment,
            verifiedCount: verifiedCount,
            streak: currentStreak(now: now),
            missedDeadlines: DeadlineMissLog.load(from: sharedDefaults),
            lastActiveAt: lastActive,
            preferences: notifications.preferences,
            now: now
        ))
        notifications.apply(plan, today: Self.localDate(for: commitment, now: now), verifiedCount: verifiedCount)
    }

    func appDidBecomeActive() async {
        sharedDefaults.set(Date.now, forKey: lastActiveKey)
        reconcileEnforcement()
        // Existing users set up their schedule before reminders existed; ask once.
        await notifications.refreshAuthorization()
        if hasCommitment, notifications.authorizationStatus == .notDetermined {
            await notifications.requestAuthorization()
        }
        refreshReminders()
    }

    /// The lock-screen "I Posted" action runs in the background, so the result
    /// has to come back as a notification.
    private func verifyFromNotification() async {
        let before = verifiedCount
        await verifyPosts()
        guard let commitment else { return }
        if verifiedCount > before {
            let state = PostingStateCalculator.state(for: commitment, verifiedCount: verifiedCount, now: .now)
            let body: String
            if state.status == .completed {
                body = "Goal done for today. Your apps stay open."
            } else if let next = state.nextDeadline {
                body = "Apps stay open. Next post due by \(next.formatted(date: .omitted, time: .shortened))."
            } else {
                body = "Apps stay open."
            }
            notifications.post(title: "Post verified", body: body, offersVerify: false)
        } else {
            notifications.post(
                title: "Couldn't verify yet",
                body: verificationMessage ?? "New posts can take a minute to show up. Try again shortly.",
                offersVerify: true
            )
        }
    }

    func todayState(now: Date = .now) -> PostingTodayState? {
        guard let commitment else { return nil }
        let calculated = PostingStateCalculator.state(for: commitment, verifiedCount: verifiedCount, now: now)
        guard developerOverrideBlocked else { return calculated }
        return .init(
            status: .blocked,
            goal: calculated.goal,
            verifiedCount: calculated.verifiedCount,
            passedDeadlineCount: max(1, calculated.passedDeadlineCount),
            nextDeadline: calculated.nextDeadline,
            shouldBlock: true
        )
    }

    func verifyPosts() async {
        guard let profile, let commitment, !isVerifying else { return }
        reconcileEnforcement()
        let verificationDay = Self.localDate(for: commitment)
        isVerifying = true
        verificationMessage = nil
        defer { isVerifying = false }
        do {
            let result = try await verificationClient.verify(username: profile.username, commitment: commitment)
            guard self.commitment == commitment,
                  self.profile == profile,
                  Self.localDate(for: commitment) == verificationDay else {
                reconcileEnforcement()
                verificationMessage = "Your day or schedule changed. Check your posts again."
                return
            }
            setVerifiedCount(result.verifiedCount)
            verificationMessage = result.verified
                ? "Public posts verified."
                : "No new qualifying public posts found yet."
        } catch {
            verificationMessage = (error as? LocalizedError)?.errorDescription
                ?? "Connect to the internet to verify your post."
        }
    }

    #if DEBUG
    func simulateMissedDeadline() {
        developerOverrideBlocked = true
        screenTime.setShielding(active: true)
    }

    func simulateVerifiedPost() {
        developerOverrideBlocked = false
        setVerifiedCount(commitment?.goal ?? verifiedCount + 1)
    }
    #endif

    private static func localDate(for commitment: PostingCommitment, now: Date = .now) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: commitment.timezoneIdentifier) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: now)
    }

    static func makeLive() -> AppSession {
        let profileStore = UserDefaultsPostingProfileStore()
        let commitmentStore = UserDefaultsPostingCommitmentStore()

        #if DEBUG
        if let scenario = ProcessInfo.processInfo.environment["POSTLOCK_UI_TEST_SCENARIO"] {
            let defaults = UserDefaults.standard
            defaults.removeObject(forKey: "postingProfile")
            defaults.removeObject(forKey: "postingCommitment")
            defaults.removeObject(forKey: "postingVerifiedCount")
            defaults.removeObject(forKey: "postingVerifiedDate")
            profileStore.save(.init(
                username: "postlocktest",
                displayName: "POSTLOCK Test",
                avatarURL: nil,
                isPublic: true,
                isVerified: false,
                verificationType: nil
            ))
            if scenario == "dashboard" {
                commitmentStore.save(.suggested(goal: 3))
                commitmentStore.saveVerifiedCount(0)
            }
        }
        #endif

        return AppSession(
            profileStore: profileStore,
            commitmentStore: commitmentStore,
            profileClient: URLSessionPostingProfileClient(baseURL: AppConfiguration.apiBaseURL),
            verificationClient: URLSessionPostVerificationClient(baseURL: AppConfiguration.apiBaseURL),
            screenTime: ScreenTimeService()
        )
    }
}
