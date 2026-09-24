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

    private let profileStore: any PostingProfileStoring
    private let commitmentStore: any PostingCommitmentStoring
    let profileClient: any PostingProfileClient
    private let verificationClient: any PostVerificationClient
    let screenTime: ScreenTimeService

    init(
        profileStore: any PostingProfileStoring,
        commitmentStore: any PostingCommitmentStoring,
        profileClient: any PostingProfileClient,
        verificationClient: any PostVerificationClient,
        screenTime: ScreenTimeService
    ) {
        self.profileStore = profileStore
        self.commitmentStore = commitmentStore
        self.profileClient = profileClient
        self.verificationClient = verificationClient
        self.screenTime = screenTime
        profile = profileStore.load()
        commitment = commitmentStore.load()
        verifiedCount = commitmentStore.loadVerifiedCount()
        if let commitment, commitmentStore.loadVerifiedDate() != Self.localDate(for: commitment) {
            verifiedCount = 0
            commitmentStore.saveVerifiedCount(0)
            commitmentStore.saveVerifiedDate(Self.localDate(for: commitment))
        }
    }

    var hasPostingProfile: Bool { profile != nil }
    var hasCommitment: Bool { commitment != nil }

    func save(_ profile: PostingProfile) {
        self.profile = profile
        profileStore.save(profile)
    }

    func save(_ commitment: PostingCommitment) {
        self.commitment = commitment
        commitmentStore.save(commitment)
        verifiedCount = 0
        commitmentStore.saveVerifiedCount(0)
        commitmentStore.saveVerifiedDate(Self.localDate(for: commitment))
        screenTime.schedule(commitment: commitment, verifiedCount: 0)
    }

    func setVerifiedCount(_ count: Int) {
        verifiedCount = max(0, min(count, commitment?.goal ?? count))
        commitmentStore.saveVerifiedCount(verifiedCount)
        if let commitment {
            commitmentStore.saveVerifiedDate(Self.localDate(for: commitment))
            screenTime.updateVerifiedCount(verifiedCount, commitment: commitment)
        }
        reconcileEnforcement()
    }

    func reconcileEnforcement(now: Date = .now) {
        guard let commitment else { return }
        screenTime.refreshAuthorization()
        let today = Self.localDate(for: commitment, now: now)
        if commitmentStore.loadVerifiedDate() != today {
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
