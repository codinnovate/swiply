import SwiftUI

struct TodayView: View {
    @Environment(AppSession.self) private var session

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 60)) { context in
                if let commitment = session.commitment,
                   let state = session.todayState(now: context.date) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Spacing.extraLarge) {
                            hero(state)
                            progress(state)
                            timeline(commitment, state: state, now: context.date)
                            if state.shouldBlock {
                                PrimaryButton(
                                    title: session.isVerifying ? "Checking Public Posts…" : "I've Posted. Check Now",
                                    isLoading: session.isVerifying,
                                    isDisabled: session.isVerifying
                                ) {
                                    Task { await session.verifyPosts() }
                                }
                                Text("Public posts can occasionally take a moment to appear.")
                                    .font(.footnote).foregroundStyle(Theme.secondaryText)
                            }
                            if let message = session.verificationMessage {
                                Text(message)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                        .padding(Spacing.extraLarge)
                    }
                    .background(Theme.background)
                    .onChange(of: state.shouldBlock) { _, _ in session.reconcileEnforcement(now: context.date) }
                }
            }
            .navigationTitle("Today")
            .background(Theme.background)
            .onAppear { session.reconcileEnforcement() }
        }
    }

    private func hero(_ state: PostingTodayState) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: Spacing.medium) {
                HStack {
                    Label(statusLabel(state), systemImage: statusIcon(state))
                        .font(.caption.weight(.black))
                        .foregroundStyle(state.shouldBlock ? Theme.danger : Theme.accent)
                    Spacer()
                    if session.screenTime.isShielding {
                        Label("APPS LOCKED", systemImage: "lock.fill")
                            .font(.caption2.weight(.black)).foregroundStyle(Theme.danger)
                    }
                }
                Text(statusTitle(state))
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                Text(statusDetail(state))
                    .foregroundStyle(Theme.secondaryText)
            }
        }
    }

    private func progress(_ state: PostingTodayState) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text("\(state.verifiedCount)").font(.system(size: 64, weight: .bold, design: .rounded))
            Text("/ \(state.goal)").font(.title2).foregroundStyle(Theme.secondaryText)
            Spacer()
            Text("POSTS").font(.caption.weight(.black)).tracking(1.5).foregroundStyle(Theme.secondaryText)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(state.verifiedCount) of \(state.goal) posts verified")
    }

    private func timeline(_ commitment: PostingCommitment, state: PostingTodayState, now: Date) -> some View {
        SurfaceCard {
            VStack(spacing: 0) {
                ForEach(commitment.deadlineMinutes.sorted().indices, id: \.self) { index in
                    let complete = state.verifiedCount > index
                    let missed = !complete && state.passedDeadlineCount > index
                    HStack(spacing: Spacing.medium) {
                        Image(systemName: complete ? "checkmark.circle.fill" : (missed ? "exclamationmark.circle.fill" : "circle"))
                            .foregroundStyle(complete ? Theme.accent : (missed ? Theme.danger : Theme.secondaryText))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(timeString(commitment.deadlineMinutes.sorted()[index]))
                                .font(.headline)
                            Text(complete ? "Verified" : (missed ? "Post required" : "At least \(index + 1) by this time"))
                                .font(.caption).foregroundStyle(Theme.secondaryText)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 12)
                    if index < commitment.goal - 1 { Divider().overlay(.white.opacity(0.08)) }
                }
            }
        }
    }

    private func statusLabel(_ state: PostingTodayState) -> String {
        switch state.status { case .active: "ON TRACK"; case .blocked: "POST REQUIRED"; case .completed: "COMPLETE"; case .paused: "REST DAY" }
    }
    private func statusIcon(_ state: PostingTodayState) -> String { state.shouldBlock ? "lock.fill" : "bolt.fill" }
    private func statusTitle(_ state: PostingTodayState) -> String {
        switch state.status {
        case .blocked: "You haven't earned this yet."
        case .completed: "\(state.goal)/\(state.goal). Done."
        case .paused: "No posts due today."
        case .active: "You're on track."
        }
    }
    private func statusDetail(_ state: PostingTodayState) -> String {
        if state.shouldBlock { return "Selected apps are locked until your next post is verified." }
        if let next = state.nextDeadline { return "Next post due at \(next.formatted(date: .omitted, time: .shortened))." }
        return state.status == .completed ? "Come back tomorrow and do it again." : "Your schedule is paused today."
    }
    private func timeString(_ minutes: Int) -> String {
        let date = Calendar.current.date(byAdding: .minute, value: minutes, to: Calendar.current.startOfDay(for: .now)) ?? .now
        return date.formatted(date: .omitted, time: .shortened)
    }
}
