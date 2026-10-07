import SwiftUI

struct TodayView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.scenePhase) private var scenePhase
    @State private var feedback = 0
    @State private var showingStreak = false

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                TimelineView(.periodic(from: .now, by: 60)) { context in
                    Group {
                        if let commitment = session.commitment,
                           let state = session.todayState(now: context.date) {
                            VStack(spacing: 0) {
                                ProfileHeader(profile: session.profile, date: context.date,
                                    timezone: TimeZone(identifier: commitment.timezoneIdentifier) ?? .current,
                                    streak: session.currentStreak(now: context.date),
                                    openStreak: { showingStreak = true })
                                    .padding(.horizontal, 24).padding(.top, 12).padding(.bottom, 8)
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
                            }
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
            .sheet(isPresented: $showingStreak) {
                StreakDetailView().presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
            }
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
        if let issue = session.screenTime.allowedAppIssue {
            return issue == .nothingSelected ? "Choose X as the allowed app in Settings" : "Pick only X (not All Apps) in Settings"
        }
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
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label(isRest ? "RECOVERY DAY" : "DAILY CHALLENGE", systemImage: isRest ? "moon" : "bolt.fill")
                        .font(.caption.weight(.bold)).tracking(1.2)
                    Spacer(minLength: 8)
                    if completed { Image(systemName: "checkmark.seal.fill") }
                }
                .foregroundStyle(Theme.accent)

                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 6) {
                        if isRest {
                            Text("Rest day").font(.system(size: 30, weight: .semibold))
                        } else {
                            HStack(alignment: .firstTextBaseline, spacing: 5) {
                                Text("\(state.verifiedCount)")
                                    .font(.system(size: 54, weight: .semibold)).tracking(-2)
                                Text("/ \(state.goal)").font(.system(size: 24, weight: .medium))
                                    .foregroundStyle(Theme.secondaryText)
                            }.monospacedDigit()
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("\(state.verifiedCount) of \(state.goal) posts verified")
                            .accessibilityIdentifier("dailyProgress")
                            Text("posts checked in").font(.caption).foregroundStyle(Theme.secondaryText)
                        }
                    }
                    Spacer(minLength: 0)
                    Image("DailyMomentum")
                        .resizable().scaledToFit()
                        .frame(width: 150, height: 138)
                        .accessibilityHidden(true)
                }

                if !isRest {
                    HStack(spacing: 5) {
                        ForEach(0..<max(1, state.goal), id: \.self) { index in
                            Capsule().fill(index < state.verifiedCount ? Theme.accent : .white.opacity(0.09))
                                .frame(height: 4)
                        }
                    }.accessibilityHidden(true)
                }
                Text(detail).font(.subheadline).foregroundStyle(Theme.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)

                if !isRest && !completed {
                    PrimaryButton(title: isVerifying ? "Checking posts..." : "Check my posts", isLoading: isVerifying) {
                        verify()
                    }
                    .accessibilityIdentifier("checkPosts")
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
            .background(LinearGradient(colors: [Theme.accent.opacity(0.13), Theme.surface], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 24))
            .overlay { RoundedRectangle(cornerRadius: 24).strokeBorder(Theme.accent.opacity(0.15)) }

            if !isRest { checkpoints }

            // Paused until live X research is available; currently using OpenAI only.
            // PostSuggestionsSection()

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
                Text("Make it count.").font(.system(size: 30, weight: .semibold)).tracking(-1)
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
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Your schedule").font(.system(size: 20, weight: .semibold)).tracking(-0.5)
                    Text(completed ? "Every checkpoint cleared" : "One checkpoint at a time")
                        .font(.caption).foregroundStyle(Theme.secondaryText)
                }
                Spacer()
                HStack(spacing: 5) {
                    Image(systemName: "checkmark").font(.system(size: 10, weight: .bold))
                    Text("\(min(state.verifiedCount, state.goal))/\(state.goal)")
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                }
                .foregroundStyle(Theme.accent)
                .padding(.horizontal, 10).padding(.vertical, 8)
                .background(Theme.accent.opacity(0.08), in: Capsule())
            }
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Circle().fill(completed ? Theme.mint : Theme.accent).frame(width: 5, height: 5)
                    Text("TODAY").tracking(1.8)
                    Spacer()
                    Text("\(commitment.goal) CHECKPOINTS").tracking(1.2)
                }
                .font(.system(size: 9, weight: .semibold)).foregroundStyle(Theme.secondaryText)
                .padding(.horizontal, 18).padding(.top, 18).padding(.bottom, 14)

                VStack(spacing: 0) {
                    ForEach(Array(commitment.deadlineMinutes.sorted().enumerated()), id: \.offset) { index, minute in
                        checkpoint(index: index, minute: minute)
                    }
                }.padding(.horizontal, 12)

                HStack(spacing: 6) {
                    Image(systemName: "globe").font(.system(size: 10))
                    Text("\(timezone.identifier.split(separator: "/").last.map(String.init)?.replacingOccurrences(of: "_", with: " ") ?? timezone.identifier) time")
                    Spacer()
                    Text("Post ahead anytime")
                }
                .font(.system(size: 10, weight: .medium)).foregroundStyle(Theme.secondaryText)
                .padding(.horizontal, 18).padding(.vertical, 14)
            }
            .background(LinearGradient(colors: [Theme.surface, Theme.background.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 24))
            .overlay {
                RoundedRectangle(cornerRadius: 24)
                    .stroke(LinearGradient(colors: [Theme.accent.opacity(0.2), .white.opacity(0.04), Theme.accent.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1)
            }
        }
    }

    private func checkpoint(index: Int, minute: Int) -> some View {
        let done = state.verifiedCount > index
        let overdue = !done && state.passedDeadlineCount > index
        let next = !done && index == state.verifiedCount
        let color = done ? Theme.mint : next ? Theme.accent : Theme.secondaryText
        return HStack(spacing: 10) {
            ZStack {
                VStack(spacing: 0) {
                    Rectangle().fill(index == 0 ? Color.clear : Theme.accent.opacity(0.18))
                    Rectangle().fill(index == commitment.goal - 1 ? Color.clear : Theme.accent.opacity(0.18))
                }.frame(width: 1)
                RoundedRectangle(cornerRadius: 10)
                    .fill(next ? Theme.accent : Theme.secondarySurface)
                    .frame(width: 30, height: 30)
                    .overlay { RoundedRectangle(cornerRadius: 10).stroke(color.opacity(next ? 0 : 0.2), lineWidth: 1) }
                if done {
                    Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.mint)
                } else {
                    Text(String(format: "%02d", index + 1))
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(next ? Theme.background : Theme.secondaryText)
                }
            }
            .frame(width: 34)
            .accessibilityHidden(true)
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(timeString(minute))
                        .font(.system(size: 19, weight: .medium, design: .monospaced)).tracking(-0.8)
                        .foregroundStyle(done ? Theme.secondaryText : .white)
                    Text("\(index + 1) \(index == 0 ? "post" : "posts") total")
                        .font(.system(size: 11)).foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 5) {
                    Text(done ? "Complete" : overdue ? "Due" : next ? "Up next" : "Later")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(overdue ? Theme.danger : color)
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background((overdue ? Theme.danger : color).opacity(0.08), in: Capsule())
                    if next {
                        Text("CHECK IN NEXT").font(.system(size: 7, weight: .semibold)).tracking(0.8)
                            .foregroundStyle(Theme.accent.opacity(0.8))
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(next ? Theme.accent.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 16))
            .overlay { RoundedRectangle(cornerRadius: 16).stroke(next ? Theme.accent.opacity(0.22) : .clear, lineWidth: 1) }
            .padding(.vertical, 3)
        }
        .fixedSize(horizontal: false, vertical: true)
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
        if isRest { return "Take a breather. No posts due today." }
        if completed { return "All done. See you tomorrow." }
        if state.shouldBlock {
            let remaining = max(1, state.passedDeadlineCount - state.verifiedCount)
            return "\(remaining) \(remaining == 1 ? "post" : "posts") to catch up. You've got this."
        }
        let deadlines = commitment.deadlineMinutes.sorted()
        if deadlines.indices.contains(state.verifiedCount) {
            return "Next check-in by \(timeString(deadlines[state.verifiedCount]))."
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
                Text("\(count)").font(.system(size: 36, weight: .semibold)).monospacedDigit()
                Text("of \(goal) posts").font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .frame(width: 104, height: 104)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) of \(goal) posts verified")
        .accessibilityIdentifier("dailyProgress")
    }
}

#Preview("Daily challenge states") {
    ScrollView(showsIndicators: false) {
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
    ScrollView(showsIndicators: false) {
        TodayChallengeView(commitment: .suggested(goal: 3),
            state: .init(status: .active, goal: 3, verifiedCount: 1, passedDeadlineCount: 1, nextDeadline: nil, shouldBlock: false),
            now: .now, username: "creator")
    }.background(Theme.background).preferredColorScheme(.dark)
}

#Preview("Verification unavailable") {
    ScrollView(showsIndicators: false) {
        TodayChallengeView(commitment: .suggested(goal: 3),
            state: .init(status: .blocked, goal: 3, verifiedCount: 1, passedDeadlineCount: 3, nextDeadline: nil, shouldBlock: true),
            now: .now, username: "creator", message: "We couldn't check your public posts right now. Please try again.")
    }.background(Theme.background).preferredColorScheme(.dark)
}

#Preview("Checking posts") {
    ScrollView(showsIndicators: false) {
        TodayChallengeView(commitment: .suggested(goal: 3),
            state: .init(status: .active, goal: 3, verifiedCount: 0, passedDeadlineCount: 0, nextDeadline: nil, shouldBlock: false),
            now: .now, isVerifying: true)
    }.background(Theme.background).preferredColorScheme(.dark)
}
