import Foundation

enum PostingStreakCalculator {
    static func count(completedDates: Set<String>, commitment: PostingCommitment, now: Date) -> Int {
        guard commitment.goal > 0, !commitment.postingDays.isEmpty, !completedDates.isEmpty else { return 0 }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: commitment.timezoneIdentifier) ?? .current
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        var day = calendar.startOfDay(for: now)
        var count = 0
        let oldest = completedDates.min() ?? formatter.string(from: day)
        while formatter.string(from: day) >= oldest {
            let key = formatter.string(from: day)
            if completedDates.contains(key) {
                count += 1
            } else if !calendar.isDate(day, inSameDayAs: now), commitment.postingDays.contains(calendar.component(.weekday, from: day)) {
                break
            }
            guard let previous = calendar.date(byAdding: .day, value: -1, to: day) else { break }
            day = previous
        }
        return count
    }
}

struct PostingCommitment: Codable, Equatable, Sendable {
    struct QualifyingPostTypes: Codable, Equatable, Sendable {
        var originalPosts = true
        var replies = false
        var reposts = false
        var quotePosts = true
    }

    var timezoneIdentifier: String
    var postingDays: Set<Int>
    var deadlineMinutes: [Int]
    var qualifyingPostTypes: QualifyingPostTypes

    var goal: Int { deadlineMinutes.count }

    static func suggested(goal: Int, timezoneIdentifier: String = TimeZone.current.identifier) -> Self {
        let presets: [Int: [Int]] = [
            1: [18 * 60],
            2: [11 * 60, 19 * 60],
            3: [10 * 60, 15 * 60, 20 * 60],
            5: [9 * 60, 12 * 60, 15 * 60, 18 * 60, 21 * 60]
        ]
        let deadlines = presets[goal] ?? evenlySpacedDeadlines(count: goal)
        return Self(
            timezoneIdentifier: timezoneIdentifier,
            postingDays: Set(1 ... 7),
            deadlineMinutes: deadlines,
            qualifyingPostTypes: .init()
        )
    }

    private static func evenlySpacedDeadlines(count: Int) -> [Int] {
        guard count > 0 else { return [] }
        let start = 9 * 60
        let end = 21 * 60
        if count == 1 { return [end] }
        return (0 ..< count).map { start + ($0 * (end - start) / (count - 1)) }
    }
}

enum PostingDayStatus: String, Sendable {
    case active
    case blocked
    case completed
    case paused
}

struct PostingTodayState: Equatable, Sendable {
    let status: PostingDayStatus
    let goal: Int
    let verifiedCount: Int
    let passedDeadlineCount: Int
    let nextDeadline: Date?
    let shouldBlock: Bool
}

enum PostingStateCalculator {
    static func state(
        for commitment: PostingCommitment,
        verifiedCount: Int,
        now: Date,
        calendar sourceCalendar: Calendar = .current
    ) -> PostingTodayState {
        guard commitment.goal > 0 else {
            return .init(status: .paused, goal: 0, verifiedCount: 0, passedDeadlineCount: 0, nextDeadline: nil, shouldBlock: false)
        }

        var calendar = sourceCalendar
        calendar.timeZone = TimeZone(identifier: commitment.timezoneIdentifier) ?? .current
        let weekday = calendar.component(.weekday, from: now)
        guard commitment.postingDays.contains(weekday) else {
            return .init(status: .paused, goal: commitment.goal, verifiedCount: verifiedCount, passedDeadlineCount: 0, nextDeadline: nil, shouldBlock: false)
        }

        let startOfDay = calendar.startOfDay(for: now)
        let deadlines = commitment.deadlineMinutes.sorted().compactMap {
            calendar.date(byAdding: .minute, value: $0, to: startOfDay)
        }
        let passed = deadlines.filter { $0 <= now }.count
        let next = deadlines.first { $0 > now }
        let completed = verifiedCount >= commitment.goal
        let blocked = !completed && verifiedCount < passed

        return .init(
            status: completed ? .completed : (blocked ? .blocked : .active),
            goal: commitment.goal,
            verifiedCount: verifiedCount,
            passedDeadlineCount: passed,
            nextDeadline: next,
            shouldBlock: blocked
        )
    }
}
