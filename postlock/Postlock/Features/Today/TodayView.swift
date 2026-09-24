import SwiftUI

struct TodayView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.scenePhase) private var scenePhase
    @State private var feedback = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                TimelineView(.periodic(from: .now, by: 60)) { context in
                    Group {
                        if let commitment = session.commitment,
                           let state = session.todayState(now: context.date) {
                            TodayChallengeView(
                                commitment: commitment, state: state, now: context.date,
                                username: session.profile?.username,
                                isVerifying: session.isVerifying,
                                message: session.verificationMessage,
                                protection: protectionLabel,
                                verify: {
                                    Task {
                                        let previous = session.verifiedCount
                                        await session.verifyPosts()
                                        if session.verifiedCount > previous { feedback += 1 }
                                    }
                                }
                            )
                        } else {
                            ContentUnavailableView {
                                Label("Start your daily challenge", systemImage: "flag.checkered")
                            } description: {
                                Text("Choose a posting goal and make room for your ideas.")
                            } actions: {
                                NavigationLink("Set up your schedule") { ScheduleSetupView() }
                            }
                        }
                    }
                    .onChange(of: context.date, initial: true) { _, date in
                        session.reconcileEnforcement(now: date)
                    }
                }
            }
            .background(Theme.background)
            .toolbar(.hidden, for: .navigationBar)
            .sensoryFeedback(.success, trigger: feedback)
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { session.reconcileEnforcement() }
            }
        }
    }

    private var protectionLabel: String {
        #if targetEnvironment(simulator)
        return "App protection requires an iPhone"
        #else
        if session.screenTime.authorizationStatus != .approved { return "App protection needs permission" }
        if !session.screenTime.hasValidXException { return "Choose X as the allowed app in Settings" }
        return session.screenTime.isShielding ? "All apps except X are locked" : "All-app protection ready"
        #endif
    }
}

private struct TodayChallengeView: View {
    let commitment: PostingCommitment
    let state: PostingTodayState
    let now: Date
    var username: String?
    var isVerifying = false
    var message: String?
    var protection = "App protection ready"
    var verify: () -> Void = {}
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isRest: Bool { state.status == .paused }
    private var completed: Bool { state.status == .completed }
    private var tint: Color { state.shouldBlock ? Theme.danger : Theme.accent }

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            header
            VStack(spacing: 20) {
                HStack {
                    Label(isRest ? "RECOVERY DAY" : "DAILY CHALLENGE", systemImage: isRest ? "moon" : "bolt.fill")
                        .font(.caption.weight(.bold)).tracking(1.2)
                    Spacer(minLength: 8)
                    if completed { Image(systemName: "checkmark.seal.fill") }
                }
                .foregroundStyle(Theme.accent)

                if isRest {
                    Image(systemName: "moon.stars")
                        .font(.system(size: 64, weight: .light))
                        .foregroundStyle(Theme.accent)
                        .frame(height: 150)
                        .accessibilityHidden(true)
                } else {
                    DailyProgressRing(count: state.verifiedCount, goal: state.goal, tint: tint)
                        .frame(height: 188)
                        .animation(reduceMotion ? nil : .easeInOut(duration: 0.4), value: state.verifiedCount)
                }

                VStack(spacing: 8) {
                    Text(headline)
                        .font(.system(.title2, design: .rounded, weight: .bold))
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

                if !isRest && !completed {
                    PrimaryButton(title: isVerifying ? "Checking posts..." : "Check my posts", isLoading: isVerifying) {
                        verify()
                    }
                    .accessibilityIdentifier("checkPosts")
                    Text("Publish on X, then check in here.")
                        .font(.caption).foregroundStyle(Theme.secondaryText)
                } else if completed {
                    Label("Daily goal complete", systemImage: "checkmark.seal.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(.vertical, 12).frame(maxWidth: .infinity)
                        .background(Theme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                }
                if let message {
                    Text(message).font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("verificationMessage")
                }
            }
            .padding(20)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 28))
            .overlay { RoundedRectangle(cornerRadius: 28).strokeBorder(.white.opacity(0.07)) }

            if !isRest { checkpoints }

            Label(protection, systemImage: "lock.shield")
                .font(.footnote).foregroundStyle(Theme.secondaryText)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.bottom, 8)
        }
        .padding(.horizontal, 24).padding(.vertical, 16)
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text(dateLabel)
                    .font(.subheadline).foregroundStyle(Theme.secondaryText)
                Text("Today").font(.system(.largeTitle, design: .rounded, weight: .bold))
            }
            Spacer()
            if let username {
                Text("@\(username)")
                    .font(.caption.weight(.semibold)).foregroundStyle(Theme.secondaryText)
                    .lineLimit(1).truncationMode(.middle)
                    .padding(10)
                    .background(Theme.secondarySurface, in: Capsule())
                    .accessibilityLabel("Connected account, \(username)")
            }
        }
    }

    private var checkpoints: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Today's checkpoints").font(.headline)
                Spacer()
                Text("\(min(state.verifiedCount, state.goal))/\(state.goal)")
                    .font(.subheadline.monospacedDigit()).foregroundStyle(Theme.secondaryText)
            }
            VStack(spacing: 0) {
                ForEach(Array(commitment.deadlineMinutes.sorted().enumerated()), id: \.offset) { index, minute in
                    checkpoint(index: index, minute: minute)
                }
            }
            Text("Post ahead anytime. Each checkpoint counts your total posts. Times in \(timezone.identifier).")
                .font(.caption).foregroundStyle(Theme.secondaryText)
        }
    }

    private func checkpoint(index: Int, minute: Int) -> some View {
        let done = state.verifiedCount > index
        let overdue = !done && state.passedDeadlineCount > index
        let next = !done && index == state.verifiedCount
        let color = done ? Theme.accent : overdue ? Theme.danger : Theme.secondaryText
        return HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 4) {
                Image(systemName: done ? "checkmark.circle.fill" : overdue ? "exclamationmark.circle" : "circle")
                    .font(.system(size: 22)).foregroundStyle(color)
                if index < commitment.goal - 1 {
                    Rectangle().fill(Theme.secondarySurface).frame(width: 2, height: 30)
                }
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(timeString(minute)).font(.subheadline.weight(.semibold)).monospacedDigit()
                    Spacer()
                    Text(done ? "Verified" : overdue ? "Catch up" : next ? "Up next" : "Upcoming")
                        .font(.caption.weight(.semibold)).foregroundStyle(color)
                }
                Text("\(index + 1) \(index == 0 ? "post" : "posts") total")
                    .font(.caption).foregroundStyle(Theme.secondaryText)
            }
            .padding(.bottom, 18)
        }
        .accessibilityElement(children: .combine)
    }

    private var headline: String {
        switch state.status {
        case .paused: "Rest is part of the rhythm."
        case .completed: "You showed up. You did it."
        case .blocked: "Let's catch up."
        case .active: state.verifiedCount == 0 ? "Make your first move." : "One step closer."
        }
    }

    private var detail: String {
        if isRest { return "No posts due today. Your next challenge is coming." }
        if completed { return "Every checkpoint cleared. See you tomorrow." }
        if state.shouldBlock {
            let remaining = max(1, state.passedDeadlineCount - state.verifiedCount)
            return "Verify \(remaining) more \(remaining == 1 ? "post" : "posts") to catch up on your deadlines."
        }
        let deadlines = commitment.deadlineMinutes.sorted()
        if deadlines.indices.contains(state.verifiedCount) {
            return "\(state.verifiedCount + 1) \(state.verifiedCount == 0 ? "post" : "posts") total by \(timeString(deadlines[state.verifiedCount])). You've got this."
        }
        return "Your first post starts today's progress."
    }

    private var timezone: TimeZone { TimeZone(identifier: commitment.timezoneIdentifier) ?? .current }

    private var dateLabel: String {
        let formatter = DateFormatter()
        formatter.timeZone = timezone
        formatter.setLocalizedDateFormatFromTemplate("EEEE MMM d")
        return formatter.string(from: now)
    }

    private func timeString(_ minutes: Int) -> String {
        var calendar = Calendar.current
        calendar.timeZone = timezone
        let date = calendar.date(byAdding: .minute, value: minutes, to: calendar.startOfDay(for: now)) ?? now
        let formatter = DateFormatter()
        formatter.timeZone = timezone
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

private struct DailyProgressRing: View {
    let count: Int
    let goal: Int
    let tint: Color
    private var fraction: CGFloat { goal > 0 ? min(1, max(0, CGFloat(count) / CGFloat(goal))) : 0 }

    var body: some View {
        ZStack {
            if (1 ... 8).contains(goal) {
                ForEach(0 ..< goal, id: \.self) { index in
                    let start = CGFloat(index) / CGFloat(goal) + 0.014
                    let end = CGFloat(index + 1) / CGFloat(goal) - 0.014
                    Circle().trim(from: start, to: end)
                        .stroke(index < count ? tint : Theme.secondarySurface, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
            } else {
                Circle().stroke(Theme.secondarySurface, lineWidth: 10)
                Circle().trim(from: 0, to: fraction)
                    .stroke(tint, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            VStack(spacing: 2) {
                Text("\(count)").font(.system(size: 62, weight: .bold, design: .rounded)).monospacedDigit()
                Text("OF \(goal) POSTS").font(.caption.weight(.semibold)).tracking(1.5)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .frame(width: 178, height: 178)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) of \(goal) posts verified")
        .accessibilityIdentifier("dailyProgress")
    }
}

#Preview("Daily challenge states") {
    ScrollView {
        ForEach([PostingDayStatus.active, .blocked, .completed, .paused], id: \.rawValue) { status in
            TodayChallengeView(
                commitment: .suggested(goal: 3),
                state: .init(status: status, goal: 3, verifiedCount: status == .completed ? 3 : 0,
                             passedDeadlineCount: status == .blocked ? 2 : 0, nextDeadline: nil, shouldBlock: status == .blocked),
                now: .now, username: "creator"
            )
        }
    }
    .background(Theme.background).preferredColorScheme(.dark)
}

#Preview("Partial progress") {
    ScrollView {
        TodayChallengeView(commitment: .suggested(goal: 3),
            state: .init(status: .active, goal: 3, verifiedCount: 1, passedDeadlineCount: 1, nextDeadline: nil, shouldBlock: false),
            now: .now, username: "creator")
    }.background(Theme.background).preferredColorScheme(.dark)
}

#Preview("Verification unavailable") {
    ScrollView {
        TodayChallengeView(commitment: .suggested(goal: 3),
            state: .init(status: .blocked, goal: 3, verifiedCount: 1, passedDeadlineCount: 3, nextDeadline: nil, shouldBlock: true),
            now: .now, username: "creator", message: "We couldn't check your public posts right now. Please try again.")
    }.background(Theme.background).preferredColorScheme(.dark)
}

#Preview("Checking posts") {
    ScrollView {
        TodayChallengeView(commitment: .suggested(goal: 3),
            state: .init(status: .active, goal: 3, verifiedCount: 0, passedDeadlineCount: 0, nextDeadline: nil, shouldBlock: false),
            now: .now, isVerifying: true)
    }.background(Theme.background).preferredColorScheme(.dark)
}
