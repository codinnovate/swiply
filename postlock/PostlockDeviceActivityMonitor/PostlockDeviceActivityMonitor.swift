import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

final class PostlockDeviceActivityMonitor: DeviceActivityMonitor {
    private let defaults = UserDefaults(suiteName: "group.com.swiply.postlock")
    private let settings = ManagedSettingsStore(named: .init("postlock"))

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        guard shouldShield(for: activity),
              let data = defaults?.data(forKey: "familyActivitySelection"),
              let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else {
            settings.clearAllSettings()
            return
        }
        settings.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        settings.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
        settings.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        defaults?.set(true, forKey: "shouldBlock")
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        settings.clearAllSettings()
        defaults?.set(false, forKey: "shouldBlock")
    }

    private func shouldShield(for activity: DeviceActivityName) -> Bool {
        guard let sequenceText = activity.rawValue.split(separator: ".").last,
              let sequence = Int(sequenceText),
              let timezoneID = defaults?.string(forKey: "postingTimezone") else { return false }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timezoneID) ?? .current
        let weekday = calendar.component(.weekday, from: .now)
        let postingDays = Set(defaults?.array(forKey: "postingDays") as? [Int] ?? [])
        guard postingDays.contains(weekday) else { return false }

        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        let count = defaults?.string(forKey: "postingVerifiedDate") == formatter.string(from: .now)
            ? defaults?.integer(forKey: "postingVerifiedCount") ?? 0
            : 0
        return count < sequence
    }
}
