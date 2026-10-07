import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

final class PostlockDeviceActivityMonitor: DeviceActivityMonitor {
    private let defaults = UserDefaults(suiteName: "group.com.swiply.postlock")
    private let settings = ManagedSettingsStore(named: .init("postlock"))

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        guard recordMissIfDue(for: activity),
              let data = defaults?.data(forKey: "allowedAppSelectionV2"),
              let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data),
              selection.applicationTokens.count == 1,
              selection.categoryTokens.isEmpty,
              selection.webDomainTokens.isEmpty else {
            settings.clearAllSettings()
            defaults?.set(false, forKey: "shouldBlock")
            return
        }
        settings.shield.applications = nil
        settings.shield.applicationCategories = .all(except: selection.applicationTokens)
        settings.shield.webDomains = nil
        defaults?.set(true, forKey: "shouldBlock")
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        settings.clearAllSettings()
        defaults?.set(false, forKey: "shouldBlock")
    }

    /// Whether this deadline was missed. Misses are logged in the app group
    /// so the app can warn earlier for this slot on later days.
    private func recordMissIfDue(for activity: DeviceActivityName) -> Bool {
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
        let today = formatter.string(from: .now)
        let count = defaults?.string(forKey: "postingVerifiedDate") == today
            ? defaults?.integer(forKey: "postingVerifiedCount") ?? 0
            : 0
        guard count < sequence else { return false }
        // Same format as DeadlineMissLog in the app.
        var misses = Set(defaults?.stringArray(forKey: "postingMissedDeadlines") ?? [])
        misses.insert("\(today)#\(sequence)")
        defaults?.set(Array(misses).sorted(), forKey: "postingMissedDeadlines")
        return true
    }
}
