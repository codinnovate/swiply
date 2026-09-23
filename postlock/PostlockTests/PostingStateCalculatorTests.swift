import Foundation
import Testing
@testable import Postlock

struct PostingStateCalculatorTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    private func date(_ hour: Int, minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: 23, hour: hour, minute: minute))!
    }

    private var commitment: PostingCommitment {
        PostingCommitment(
            timezoneIdentifier: "UTC",
            postingDays: Set(1 ... 7),
            deadlineMinutes: [10 * 60, 15 * 60, 20 * 60],
            qualifyingPostTypes: .init()
        )
    }

    @Test func staysOnTrackBeforeFirstDeadline() {
        let state = PostingStateCalculator.state(for: commitment, verifiedCount: 0, now: date(9), calendar: calendar)
        #expect(state.status == .active)
        #expect(state.shouldBlock == false)
        #expect(state.passedDeadlineCount == 0)
    }

    @Test func blocksAfterMissedCumulativeDeadline() {
        let state = PostingStateCalculator.state(for: commitment, verifiedCount: 0, now: date(10, minute: 1), calendar: calendar)
        #expect(state.status == .blocked)
        #expect(state.shouldBlock)
        #expect(state.passedDeadlineCount == 1)
    }

    @Test func verifiedPostSatisfiesPassedDeadline() {
        let state = PostingStateCalculator.state(for: commitment, verifiedCount: 1, now: date(14), calendar: calendar)
        #expect(state.status == .active)
        #expect(state.shouldBlock == false)
        #expect(state.nextDeadline == date(15))
    }

    @Test func completionUnlocksAfterAllDeadlines() {
        let state = PostingStateCalculator.state(for: commitment, verifiedCount: 3, now: date(22), calendar: calendar)
        #expect(state.status == .completed)
        #expect(state.shouldBlock == false)
    }

    @Test func excludedWeekdayIsRestDay() {
        var restDayCommitment = commitment
        restDayCommitment.postingDays = [1]
        let state = PostingStateCalculator.state(for: restDayCommitment, verifiedCount: 0, now: date(22), calendar: calendar)
        #expect(state.status == .paused)
        #expect(state.shouldBlock == false)
    }

    @Test func suggestedCustomGoalNeverExceedsRequestedCount() {
        let custom = PostingCommitment.suggested(goal: 10, timezoneIdentifier: "UTC")
        #expect(custom.goal == 10)
        #expect(custom.deadlineMinutes == custom.deadlineMinutes.sorted())
        #expect(Set(custom.deadlineMinutes).count == 10)
    }
}
