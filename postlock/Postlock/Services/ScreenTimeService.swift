import FamilyControls
import Foundation
import DeviceActivity
import ManagedSettings
import Observation

@MainActor
@Observable
final class ScreenTimeService {
    private(set) var authorizationStatus = AuthorizationCenter.shared.authorizationStatus
    var selection: FamilyActivitySelection {
        didSet { persistSelection() }
    }
    private(set) var isShielding = false

    private let store = ManagedSettingsStore(named: .postlock)
    private let defaults: UserDefaults
    // This is deliberately a new key. Older releases stored apps to block;
    // interpreting those tokens as apps to allow would invert the user's choice.
    static let allowedAppSelectionKey = "allowedAppSelectionV2"
    private let activityCenter = DeviceActivityCenter()

    init() {
        defaults = UserDefaults(suiteName: AppGroup.identifier) ?? .standard
        selection = defaults.data(forKey: Self.allowedAppSelectionKey)
            .flatMap { try? JSONDecoder().decode(FamilyActivitySelection.self, from: $0) }
            ?? .init()
    }

    var selectedCount: Int {
        selection.applicationTokens.count
    }

    var hasValidXException: Bool {
        selection.applicationTokens.count == 1
            && selection.categoryTokens.isEmpty
            && selection.webDomainTokens.isEmpty
    }

    func requestAuthorization() async throws {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        authorizationStatus = AuthorizationCenter.shared.authorizationStatus
    }

    func refreshAuthorization() {
        authorizationStatus = AuthorizationCenter.shared.authorizationStatus
    }

    func setShielding(active: Bool) {
        guard active, hasValidXException else {
            isShielding = false
            store.clearAllSettings()
            SharedEnforcementStore.setShouldBlock(false)
            return
        }
        isShielding = true
        store.shield.applications = nil
        store.shield.applicationCategories = .all(except: selection.applicationTokens)
        store.shield.webDomains = nil
        SharedEnforcementStore.setShouldBlock(true)
    }

    func schedule(commitment: PostingCommitment, verifiedCount: Int) {
        persistSchedule(commitment, verifiedCount: verifiedCount)
        let oldNames = (1 ... 10).map { DeviceActivityName("postlock.deadline.\($0)") }
        activityCenter.stopMonitoring(oldNames)

        for (index, minutes) in commitment.deadlineMinutes.sorted().enumerated() {
            let schedule = DeviceActivitySchedule(
                intervalStart: DateComponents(hour: minutes / 60, minute: minutes % 60),
                intervalEnd: DateComponents(hour: 23, minute: 59),
                repeats: true
            )
            try? activityCenter.startMonitoring(
                DeviceActivityName("postlock.deadline.\(index + 1)"),
                during: schedule
            )
        }
    }

    func updateVerifiedCount(_ count: Int, commitment: PostingCommitment) {
        persistSchedule(commitment, verifiedCount: count)
    }

    private func persistSelection() {
        defaults.set(try? JSONEncoder().encode(selection), forKey: Self.allowedAppSelectionKey)
        if isShielding {
            setShielding(active: true)
        }
    }

    private func persistSchedule(_ commitment: PostingCommitment, verifiedCount: Int) {
        defaults.set(Array(commitment.postingDays), forKey: "postingDays")
        defaults.set(commitment.timezoneIdentifier, forKey: "postingTimezone")
        defaults.set(verifiedCount, forKey: "postingVerifiedCount")
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: commitment.timezoneIdentifier) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        defaults.set(formatter.string(from: .now), forKey: "postingVerifiedDate")
    }
}

@MainActor
extension ManagedSettingsStore.Name {
    static let postlock = Self("postlock")
}

enum AppGroup {
    static let identifier = "group.com.swiply.postlock"
}

enum SharedEnforcementStore {
    private static var defaults: UserDefaults { UserDefaults(suiteName: AppGroup.identifier) ?? .standard }
    static func setShouldBlock(_ value: Bool) { defaults.set(value, forKey: "shouldBlock") }
    static var shouldBlock: Bool { defaults.bool(forKey: "shouldBlock") }
}
