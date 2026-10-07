import Foundation
import Observation
import UserNotifications

/// Local reminders before each posting deadline. They're scheduled on-device
/// (like the Screen Time lock itself) so they fire on time with no network.
@MainActor
@Observable
final class NotificationService {
    nonisolated static let deadlineCategory = "postlock.deadline"
    nonisolated static let verifyAction = "postlock.verify"

    private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    var preferences: ReminderPreferences {
        didSet {
            guard preferences != oldValue else { return }
            defaults.set(try? JSONEncoder().encode(preferences), forKey: Self.preferencesKey)
            onPreferencesChanged?()
        }
    }
    /// Bumped when a notification tap should bring the Today tab forward.
    private(set) var openTodayRequests = 0

    @ObservationIgnored var onPreferencesChanged: (@MainActor () -> Void)?
    @ObservationIgnored var onVerifyRequested: (@MainActor () async -> Void)?

    @ObservationIgnored private let center = UNUserNotificationCenter.current()
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let delegate = NotificationDelegate()
    @ObservationIgnored private var applyTask: Task<Void, Never>?
    private static let preferencesKey = "reminderPreferences"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        preferences = defaults.data(forKey: Self.preferencesKey)
            .flatMap { try? JSONDecoder().decode(ReminderPreferences.self, from: $0) }
            ?? .init()
        delegate.service = self
        // Must be set before launch finishes so lock-screen actions reach us.
        center.delegate = delegate
        let verify = UNNotificationAction(
            identifier: Self.verifyAction,
            title: "I Posted",
            options: [],
            icon: UNNotificationActionIcon(systemImageName: "checkmark.seal")
        )
        center.setNotificationCategories([
            UNNotificationCategory(identifier: Self.deadlineCategory, actions: [verify], intentIdentifiers: [])
        ])
    }

    var isAuthorized: Bool {
        authorizationStatus == .authorized || authorizationStatus == .provisional || authorizationStatus == .ephemeral
    }

    func refreshAuthorization() async {
        authorizationStatus = await center.notificationSettings().authorizationStatus
    }

    /// Returns whether reminders can be delivered afterwards.
    @discardableResult
    func requestAuthorization() async -> Bool {
        #if DEBUG
        // Screenshot runs launch into a seeded scenario; keep the system prompt out of frame.
        if ProcessInfo.processInfo.environment["POSTLOCK_UI_TEST_SCENARIO"] != nil { return isAuthorized }
        #endif
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
        await refreshAuthorization()
        return isAuthorized
    }

    /// Replaces POSTLOCK's pending reminders with `plan`. Calls are serialized
    /// so overlapping refreshes can't leave a stale request behind.
    func apply(_ plan: [PlannedReminder], today: String, verifiedCount: Int) {
        let previous = applyTask
        applyTask = Task {
            await previous?.value
            await refreshAuthorization()
            await replacePending(with: isAuthorized ? plan : [])
            await clearStaleDelivered(today: today, verifiedCount: verifiedCount)
        }
    }

    func post(title: String, body: String, offersVerify: Bool) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        if offersVerify { content.categoryIdentifier = Self.deadlineCategory }
        center.add(UNNotificationRequest(identifier: "\(ReminderPlanner.identifierPrefix)result", content: content, trigger: nil))
    }

    fileprivate func handle(actionIdentifier: String) async {
        switch actionIdentifier {
        case Self.verifyAction:
            await onVerifyRequested?()
        case UNNotificationDefaultActionIdentifier:
            openTodayRequests += 1
        default:
            break
        }
    }

    private func replacePending(with plan: [PlannedReminder]) async {
        let pending = await center.pendingNotificationRequests()
            .map(\.identifier)
            .filter { $0.hasPrefix(ReminderPlanner.identifierPrefix) }
        let wanted = Set(plan.map(\.identifier))
        center.removePendingNotificationRequests(withIdentifiers: pending.filter { !wanted.contains($0) })

        for reminder in plan {
            let content = UNMutableNotificationContent()
            content.title = reminder.title
            content.body = reminder.body
            content.sound = .default
            content.threadIdentifier = reminder.kind == .awayCheckIn ? "postlock.away" : "postlock.deadlines"
            content.interruptionLevel = reminder.interruptionLevel
            content.relevanceScore = reminder.kind.isUrgent ? 1 : 0.5
            if reminder.kind.offersVerify { content.categoryIdentifier = Self.deadlineCategory }
            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: reminder.fireDate)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            // Re-adding an identifier replaces it, so unchanged reminders just refresh.
            try? await center.add(UNNotificationRequest(identifier: reminder.identifier, content: content, trigger: trigger))
        }
    }

    private func clearStaleDelivered(today: String, verifiedCount: Int) async {
        let delivered = await center.deliveredNotifications().map(\.request.identifier)
        let stale = ReminderPlanner.staleDeliveredIdentifiers(delivered, today: today, verifiedCount: verifiedCount)
        if !stale.isEmpty { center.removeDeliveredNotifications(withIdentifiers: stale) }
    }
}

private extension PlannedReminder {
    var interruptionLevel: UNNotificationInterruptionLevel {
        switch kind {
        case .finalWarning, .locked: .timeSensitive
        case .morningPlan, .awayCheckIn: .passive
        case .earlyNudge, .warning: .active
        }
    }
}

@MainActor
private final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    weak var service: NotificationService?

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        // In the foreground the Today screen already shows the countdown, so
        // only let deadline alerts through as banners.
        notification.request.content.categoryIdentifier == NotificationService.deadlineCategory
            ? [.banner, .list, .sound]
            : [.list]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let action = response.actionIdentifier
        await service?.handle(actionIdentifier: action)
    }
}
