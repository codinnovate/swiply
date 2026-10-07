import Foundation
import Testing
@testable import Postlock

struct ReminderPlannerTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    /// 2026-09-23 is a Wednesday (weekday 4).
    private func date(day: Int = 23, _ hour: Int, minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: day, hour: hour, minute: minute))!
    }

    private var commitment: PostingCommitment {
        PostingCommitment(
            timezoneIdentifier: "UTC",
            postingDays: Set(1 ... 7),
            deadlineMinutes: [10 * 60, 15 * 60, 20 * 60],
            qualifyingPostTypes: .init()
        )
    }

    private func context(
        verified: Int = 0,
        streak: Int = 0,
        misses: Set<String> = [],
        preferences: ReminderPreferences = .init(morningPlan: false, awayCheckIns: false),
        now: Date? = nil,
        commitment: PostingCommitment? = nil
    ) -> ReminderContext {
        ReminderContext(
            commitment: commitment ?? self.commitment,
            verifiedCount: verified,
            streak: streak,
            missedDeadlines: misses,
            lastActiveAt: now ?? date(9),
            preferences: preferences,
            now: now ?? date(9)
        )
    }

    private func todays(_ plan: [PlannedReminder], day: Int = 23) -> [PlannedReminder] {
        plan.filter { $0.identifier.contains("2026-09-\(day).") }
    }

    @Test func warnsBeforeTheNextDeadlineAndAtLock() {
        let plan = todays(ReminderPlanner.plan(context()))
        let first = plan.filter { $0.identifier.contains(".1.") }
        #expect(first.map(\.kind) == [.warning, .finalWarning, .locked])
        #expect(first.map(\.fireDate) == [date(9, minute: 30), date(9, minute: 50), date(10)])
        #expect(first[0].body.contains("1 post due by"))
    }

    @Test func laterDeadlinesGetOnlyAFinalWarningWithCumulativeCount() {
        let plan = todays(ReminderPlanner.plan(context()))
        let second = plan.filter { $0.identifier.contains(".2.") }
        #expect(second.map(\.kind) == [.finalWarning])
        #expect(second[0].body.contains("2 posts due by"))
    }

    @Test func verifiedDeadlinesAreNotReminded() {
        let plan = todays(ReminderPlanner.plan(context(verified: 1)))
        #expect(!plan.contains { $0.identifier.contains(".1.") })
        #expect(plan.filter { $0.identifier.contains(".2.") }.map(\.kind) == [.warning, .finalWarning, .locked])
        #expect(todays(ReminderPlanner.plan(context(verified: 3))).isEmpty)
    }

    @Test func skipsRemindersAlreadyInThePast() {
        let plan = todays(ReminderPlanner.plan(context(now: date(9, minute: 45))))
        #expect(plan.filter { $0.identifier.contains(".1.") }.map(\.kind) == [.finalWarning, .locked])
        #expect(plan.allSatisfy { $0.fireDate > date(9, minute: 45) })
    }

    @Test func alreadyLockedUserIsWarnedAboutTheNextDeadline() {
        let plan = todays(ReminderPlanner.plan(context(now: date(12))))
        #expect(plan.first?.identifier == "postlock.deadline.2026-09-23.2.finalWarning")
        #expect(plan.first?.body.contains("2 posts due by") == true)
    }

    @Test func restDaysGetNoReminders() {
        var restDays = commitment
        restDays.postingDays = [4]
        let plan = ReminderPlanner.plan(context(commitment: restDays))
        #expect(plan.allSatisfy { $0.identifier.contains("2026-09-23") || $0.identifier.contains("2026-09-30") })
        #expect(!plan.isEmpty)
    }

    @Test func slotMissedRepeatedlyGetsAnEarlierNudge() {
        let misses: Set<String> = ["2026-09-21#1", "2026-09-22#1"]
        let plan = todays(ReminderPlanner.plan(context(misses: misses, now: date(8))))
        let first = plan.filter { $0.identifier.contains(".1.") }
        #expect(first.first?.kind == .earlyNudge)
        #expect(first.first?.fireDate == date(9))
        #expect(!plan.contains { $0.identifier.contains(".2.earlyNudge") })
    }

    @Test func longCleanStreakDropsTheFirstWarning() {
        let plan = todays(ReminderPlanner.plan(context(streak: 10)))
        #expect(!plan.contains { $0.kind == .warning })
        #expect(plan.contains { $0.kind == .finalWarning })

        let slipped = todays(ReminderPlanner.plan(context(streak: 10, misses: ["2026-09-20#2"])))
        #expect(slipped.contains { $0.kind == .warning })
    }

    @Test func mentionsTheStreakAtStake() {
        let plan = todays(ReminderPlanner.plan(context(streak: 4)))
        #expect(plan.first { $0.kind == .warning }?.body.contains("4-day streak") == true)
    }

    @Test func morningPlanOnlyWhenTheFirstDeadlineIsHoursAway() {
        let preferences = ReminderPreferences(awayCheckIns: false)
        let early = ReminderPlanner.plan(context(preferences: preferences, now: date(6)))
        #expect(early.contains { $0.identifier == "postlock.morning.2026-09-23" } == false)

        var late = commitment
        late.deadlineMinutes = [13 * 60]
        let plan = ReminderPlanner.plan(context(preferences: preferences, now: date(6), commitment: late))
        let morning = plan.first { $0.identifier == "postlock.morning.2026-09-23" }
        #expect(morning?.fireDate == date(8))
        #expect(morning?.title == "Today: 1 post")
    }

    @Test func awayCheckInsFollowLastActivity() {
        let plan = ReminderPlanner.plan(context(preferences: .init(deadlineWarnings: false, morningPlan: false)))
        #expect(plan.map(\.identifier) == ["postlock.away.1", "postlock.away.2"])
        #expect(plan.first?.fireDate == date(day: 25, 11))
    }

    @Test func turningWarningsOffLeavesNoDeadlineReminders() {
        let plan = ReminderPlanner.plan(context(preferences: .init(deadlineWarnings: false, morningPlan: false, awayCheckIns: false)))
        #expect(plan.isEmpty)
    }

    @Test func staysWithinThePendingBudgetInChronologicalOrder() {
        var busy = commitment
        busy.deadlineMinutes = Array(stride(from: 9 * 60, through: 22 * 60, by: 60)).prefix(10).map { $0 }
        let plan = ReminderPlanner.plan(context(preferences: .init(), now: date(0), commitment: busy))
        #expect(plan.count == ReminderPlanner.pendingBudget)
        #expect(plan.map(\.fireDate) == plan.map(\.fireDate).sorted())
        #expect(Set(plan.map(\.identifier)).count == plan.count)
    }

    @Test func clearsDeliveredRemindersThatNoLongerApply() {
        let stale = ReminderPlanner.staleDeliveredIdentifiers([
            "postlock.deadline.2026-09-22.3.locked",
            "postlock.deadline.2026-09-23.1.finalWarning",
            "postlock.deadline.2026-09-23.2.warning",
            "postlock.morning.2026-09-22",
            "postlock.morning.2026-09-23",
            "postlock.away.1"
        ], today: "2026-09-23", verifiedCount: 1)
        #expect(stale == [
            "postlock.deadline.2026-09-22.3.locked",
            "postlock.deadline.2026-09-23.1.finalWarning",
            "postlock.morning.2026-09-22"
        ])
    }

    @Test func missLogKeepsRecentEntriesOnly() {
        let defaults = UserDefaults(suiteName: "ReminderPlannerTests.\(UUID().uuidString)")!
        defaults.set(["2026-08-01#1"], forKey: DeadlineMissLog.key)
        #expect(DeadlineMissLog.record(day: "2026-09-23", sequences: [1, 2], calendar: calendar, now: date(12), in: defaults))
        #expect(DeadlineMissLog.load(from: defaults) == ["2026-09-23#1", "2026-09-23#2"])
        #expect(!DeadlineMissLog.record(day: "2026-09-23", sequences: [1], calendar: calendar, now: date(12), in: defaults))
    }
}
