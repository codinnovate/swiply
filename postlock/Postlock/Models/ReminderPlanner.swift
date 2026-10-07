import Foundation

struct ReminderPreferences: Codable, Equatable, Sendable {
    var deadlineWarnings = true
    var firstWarningMinutes = 30
    var morningPlan = true
    var awayCheckIns = true

    static let firstWarningOptions = [30, 60, 120]
}

struct PlannedReminder: Equatable, Sendable {
    enum Kind: String, Sendable {
        case earlyNudge, warning, finalWarning, locked, morningPlan, awayCheckIn

        /// Warnings the user can act on from the lock screen with "I posted".
        var offersVerify: Bool { self == .warning || self == .finalWarning || self == .locked || self == .earlyNudge }
        var isUrgent: Bool { self == .finalWarning || self == .locked }
    }

    let identifier: String
    let kind: Kind
    let fireDate: Date
    let title: String
    let body: String
}

struct ReminderContext: Sendable {
    var commitment: PostingCommitment
    var verifiedCount: Int
    var streak: Int
    /// `DeadlineMissLog` entries, "yyyy-MM-dd#sequence".
    var missedDeadlines: Set<String>
    var lastActiveAt: Date
    var preferences: ReminderPreferences
    var now: Date
}

/// Deadlines the user let lapse, written by the app and the monitor extension
/// into the shared app group so reminders can adapt to where the user slips.
enum DeadlineMissLog {
    static let key = "postingMissedDeadlines"
    private static let retentionDays = 21

    static func entry(day: String, sequence: Int) -> String { "\(day)#\(sequence)" }

    static func load(from defaults: UserDefaults) -> Set<String> {
        Set(defaults.stringArray(forKey: key) ?? [])
    }

    /// Returns whether anything new was recorded.
    @discardableResult
    static func record(day: String, sequences: some Sequence<Int>, calendar: Calendar, now: Date, in defaults: UserDefaults) -> Bool {
        var entries = load(from: defaults)
        let before = entries
        entries.formUnion(sequences.map { entry(day: day, sequence: $0) })
        let formatter = ReminderPlanner.dayFormatter(calendar: calendar)
        if let cutoff = calendar.date(byAdding: .day, value: -retentionDays, to: now) {
            let cutoffKey = formatter.string(from: cutoff)
            entries = entries.filter { $0 >= cutoffKey }
        }
        guard entries != before else { return false }
        defaults.set(Array(entries).sorted(), forKey: key)
        return true
    }
}

/// Decides which local notifications should be pending right now. Pure, so the
/// whole plan is rebuilt and diffed whenever posting state changes.
enum ReminderPlanner {
    static let identifierPrefix = "postlock."
    static let deadlinePrefix = "postlock.deadline."
    static let morningPrefix = "postlock.morning."
    /// iOS keeps at most 64 pending requests per app; leave headroom for one-off alerts.
    static let pendingBudget = 60
    static let horizonDays = 7
    static let finalWarningMinutes = 10
    static let morningHour = 8
    /// A deadline slot missed on this many of the last 7 days gets an earlier nudge.
    static let strugglingMissCount = 2
    /// Streaks this long with no misses in two weeks drop the first warning.
    static let disciplinedStreak = 7

    static func plan(_ context: ReminderContext) -> [PlannedReminder] {
        let commitment = context.commitment
        let preferences = context.preferences
        let calendar = calendar(for: commitment)
        let dayFormatter = dayFormatter(calendar: calendar)
        let timeFormatter = DateFormatter()
        timeFormatter.dateStyle = .none
        timeFormatter.timeStyle = .short
        timeFormatter.timeZone = calendar.timeZone

        let today = calendar.startOfDay(for: context.now)
        let recentKeys = Set((0 ..< 7).compactMap { calendar.date(byAdding: .day, value: -$0, to: today) }.map(dayFormatter.string))
        let twoWeeksAgo = calendar.date(byAdding: .day, value: -14, to: today).map(dayFormatter.string) ?? ""
        let disciplined = context.streak >= disciplinedStreak && !context.missedDeadlines.contains { $0 >= twoWeeksAgo }
        let deadlineMinutes = commitment.deadlineMinutes.sorted()

        func struggling(_ sequence: Int) -> Bool {
            recentKeys.filter { context.missedDeadlines.contains(DeadlineMissLog.entry(day: $0, sequence: sequence)) }.count >= strugglingMissCount
        }

        var reminders: [PlannedReminder] = []

        for offset in 0 ..< (commitment.goal > 0 ? horizonDays : 0) {
            guard let day = calendar.date(byAdding: .day, value: offset, to: today),
                  commitment.postingDays.contains(calendar.component(.weekday, from: day)) else { continue }
            let dayKey = dayFormatter.string(from: day)
            let verified = offset == 0 ? context.verifiedCount : 0
            guard verified < deadlineMinutes.count else { continue }
            let streakLine: String? = context.streak > 0
                ? (offset == 0 ? "Your \(context.streak)-day streak is on the line." : "Keep your streak alive.")
                : nil
            let variant = (calendar.ordinality(of: .day, in: .era, for: day) ?? 0)

            for index in verified ..< deadlineMinutes.count {
                guard let deadline = calendar.date(byAdding: .minute, value: deadlineMinutes[index], to: day) else { continue }
                let sequence = index + 1
                let needed = sequence - verified
                let isNextDue = index == verified
                let time = timeFormatter.string(from: deadline)
                let due = needed == 1 ? "1 post due by \(time)" : "\(needed) posts due by \(time)"

                // Later deadlines only matter if the user stays behind, and any
                // verification replans, so they get a single final warning.
                var ladder: [(PlannedReminder.Kind, Int)] = []
                if preferences.deadlineWarnings {
                    if isNextDue, struggling(sequence) {
                        ladder.append((.earlyNudge, max(preferences.firstWarningMinutes * 2, 60)))
                    }
                    if isNextDue, !disciplined {
                        ladder.append((.warning, preferences.firstWarningMinutes))
                    }
                    ladder.append((.finalWarning, finalWarningMinutes))
                    if isNextDue { ladder.append((.locked, 0)) }
                }

                for (kind, lead) in ladder {
                    guard let fire = calendar.date(byAdding: .minute, value: -lead, to: deadline), fire > context.now else { continue }
                    let (title, body): (String, String)
                    switch kind {
                    case .earlyNudge:
                        title = "Get ahead: apps lock at \(time)"
                        body = "You've missed this deadline lately. \(due), so start the draft now."
                    case .warning:
                        let bodies = [
                            "\(due). Post now and verify so your phone stays open.",
                            "\(due). A quick take is enough. Ship it, then verify.",
                            "\(due). Beat the clock and keep your apps."
                        ]
                        title = "Apps lock in \(leadText(lead))"
                        body = [bodies[(variant + sequence) % bodies.count], streakLine].compactMap { $0 }.joined(separator: " ")
                    case .finalWarning:
                        title = "\(lead) min until apps lock"
                        body = ["\(due). Post on X, then tap I Posted.", streakLine].compactMap { $0 }.joined(separator: " ")
                    case .locked:
                        title = "Apps locked"
                        body = "You're \(needed) post\(needed == 1 ? "" : "s") short. Post on X, then verify to unlock everything."
                    case .morningPlan, .awayCheckIn:
                        continue
                    }
                    reminders.append(.init(
                        identifier: "\(deadlinePrefix)\(dayKey).\(sequence).\(kind.rawValue)",
                        kind: kind, fireDate: fire, title: title, body: body
                    ))
                }
            }

            // A morning heads-up only helps when the first deadline is hours away.
            if preferences.morningPlan, verified == 0,
               let morning = calendar.date(byAdding: .hour, value: morningHour, to: day), morning > context.now,
               let firstDeadline = calendar.date(byAdding: .minute, value: deadlineMinutes[0], to: day),
               firstDeadline.timeIntervalSince(morning) >= 3 * 3600 {
                let goal = commitment.goal
                let tail = offset == 0 && context.streak > 0
                    ? "Make it day \(context.streak + 1) of your streak."
                    : "Plan it now so it isn't a scramble later."
                reminders.append(.init(
                    identifier: "\(morningPrefix)\(dayKey)",
                    kind: .morningPlan,
                    fireDate: morning,
                    title: "Today: \(goal) post\(goal == 1 ? "" : "s")",
                    body: "First one due by \(timeFormatter.string(from: firstDeadline)). \(tail)"
                ))
            }
        }

        if preferences.awayCheckIns {
            let checkIns: [(days: Int, title: String, body: String)] = [
                (2, "How are your posts doing?", "See how your latest posts scored and where you rank this week."),
                (5, "Your schedule is still on", "Open POSTLOCK to check today's deadlines before your apps lock.")
            ]
            let lastActiveDay = calendar.startOfDay(for: context.lastActiveAt)
            for (number, checkIn) in checkIns.enumerated() {
                guard let day = calendar.date(byAdding: .day, value: checkIn.days, to: lastActiveDay),
                      let fire = calendar.date(byAdding: .hour, value: 11, to: day), fire > context.now else { continue }
                reminders.append(.init(
                    identifier: "\(identifierPrefix)away.\(number + 1)",
                    kind: .awayCheckIn, fireDate: fire, title: checkIn.title, body: checkIn.body
                ))
            }
        }

        return Array(reminders.sorted { $0.fireDate < $1.fireDate }.prefix(pendingBudget))
    }

    /// Delivered reminders that no longer apply: earlier days, or deadlines
    /// today the user has since verified.
    static func staleDeliveredIdentifiers(_ identifiers: [String], today: String, verifiedCount: Int) -> [String] {
        identifiers.filter { identifier in
            if identifier.hasPrefix(morningPrefix) {
                return String(identifier.dropFirst(morningPrefix.count)) < today
            }
            guard identifier.hasPrefix(deadlinePrefix) else { return false }
            let parts = identifier.dropFirst(deadlinePrefix.count).split(separator: ".")
            guard parts.count >= 2, let sequence = Int(parts[1]) else { return false }
            let day = String(parts[0])
            return day < today || (day == today && sequence <= verifiedCount)
        }
    }

    static func calendar(for commitment: PostingCommitment) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: commitment.timezoneIdentifier) ?? .current
        return calendar
    }

    static func dayFormatter(calendar: Calendar) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    private static func leadText(_ minutes: Int) -> String {
        minutes < 60 ? "\(minutes) min" : "\(minutes / 60) hr"
    }
}
