import SwiftUI

struct HistoryView: View {
    @Environment(AppSession.self) private var session
    @Environment(ViralityStore.self) private var store
    @State private var expandedPostID: String?
    @State private var rewriting: ScoredPost?

    private var username: String { session.profile?.username ?? "" }
    private var timezone: String { session.commitment?.timezoneIdentifier ?? TimeZone.current.identifier }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spacing.large) {
                    if let error = store.historyError {
                        Label(error, systemImage: "wifi.exclamationmark")
                            .font(.footnote).foregroundStyle(Theme.danger)
                    }
                    if let history = store.history {
                        content(history)
                    } else if store.isSyncing {
                        ProgressView("Checking your recent posts...")
                            .frame(maxWidth: .infinity).padding(.top, 80)
                    }
                }
                .padding(.horizontal, Spacing.large)
                .padding(.bottom, Spacing.huge)
            }
            .background(Theme.background)
            .navigationTitle("History")
            .refreshable { await store.refreshHistory(username: username, timezone: timezone) }
            .task(id: username) { await store.refreshHistory(username: username, timezone: timezone) }
            .sheet(item: $rewriting) { post in
                RewriteSheet(post: post, username: username)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    @ViewBuilder
    private func content(_ history: PostHistory) -> some View {
        if !history.scoringAvailable {
            Label("Scoring is temporarily unavailable. Your posts will be scored soon.", systemImage: "hourglass")
                .font(.footnote).foregroundStyle(Theme.secondaryText)
        }
        if history.posts.isEmpty {
            ContentUnavailableView(
                "No posts yet",
                systemImage: "text.bubble",
                description: Text("Publish a post on X from @\(username), then pull to refresh to get its virality score.")
            )
            .padding(.top, 60)
        } else {
            InsightsCard(insights: history.insights)
            ForEach(history.posts) { post in
                PostScoreCard(
                    post: post,
                    isExpanded: expandedPostID == post.postId,
                    toggle: {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            expandedPostID = expandedPostID == post.postId ? nil : post.postId
                        }
                    },
                    rewrite: { rewriting = post }
                )
            }
        }
    }
}

// MARK: - Insights

private struct InsightsCard: View {
    let insights: PostInsights

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: Spacing.medium) {
                Label("INSIGHTS", systemImage: "sparkles")
                    .font(.caption.weight(.bold)).tracking(1.2)
                    .foregroundStyle(Theme.accent)
                switch insights.status {
                case .needsMorePosts:
                    Text("Insights unlock after \(insights.minimumPosts) scored posts")
                        .font(.headline)
                    ProgressView(value: Double(insights.scoredPostCount), total: Double(insights.minimumPosts))
                        .tint(Theme.accent)
                    Text("\(insights.scoredPostCount) of \(insights.minimumPosts) scored. Keep posting and POSTLOCK will spot your patterns.")
                        .font(.footnote).foregroundStyle(Theme.secondaryText)
                case .ready where insights.insights.isEmpty:
                    Text("No clear patterns yet. Your posts are consistent across the board.")
                        .font(.subheadline).foregroundStyle(Theme.secondaryText)
                case .ready:
                    ForEach(insights.insights) { insight in
                        InsightRow(insight: insight)
                    }
                }
            }
        }
    }
}

private struct InsightRow: View {
    let insight: PostInsight

    private var icon: (name: String, color: Color) {
        switch insight.kind {
        case .warning: ("exclamationmark.triangle.fill", Theme.danger)
        case .weakness: ("arrow.down.right.circle.fill", Color.orange)
        case .opportunity: ("arrow.up.right.circle.fill", Theme.accent)
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.medium) {
            Image(systemName: icon.name).foregroundStyle(icon.color).font(.body)
            VStack(alignment: .leading, spacing: 3) {
                Text(insight.title).font(.subheadline.weight(.semibold))
                Text(insight.message)
                    .font(.footnote).foregroundStyle(Theme.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Post

private struct PostScoreCard: View {
    let post: ScoredPost
    let isExpanded: Bool
    let toggle: () -> Void
    let rewrite: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.medium) {
            Button(action: toggle) { summary }
                .buttonStyle(.plain)
                .accessibilityHint(isExpanded ? "Hides the score breakdown" : "Shows the score breakdown")

            if isExpanded, let score = post.score {
                Divider().overlay(Color.white.opacity(0.08))
                ScoreBreakdownView(score: score)
                suggestions(score)
                HStack(spacing: Spacing.medium) {
                    Button(action: rewrite) {
                        Label("Rewrite with AI", systemImage: "wand.and.stars")
                            .fontWeight(.semibold).frame(maxWidth: .infinity).frame(minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accent)
                    .foregroundStyle(.black)
                    Link(destination: post.url) {
                        Label("Open on X", systemImage: "arrow.up.right")
                            .fontWeight(.semibold).frame(minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(Spacing.large)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22))
        .overlay { RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.07), lineWidth: 1) }
    }

    private var summary: some View {
        HStack(alignment: .top, spacing: Spacing.medium) {
            if let score = post.score {
                ScoreBadge(score: Double(score.totalScore))
            } else {
                PendingScoreBadge(failed: post.scoreStatus == .failed)
            }
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text(post.postedAt, format: .relative(presentation: .named))
                    if post.isThread { Text("· Thread of \(post.threadLength)") }
                    Spacer(minLength: 0)
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)

                Text(post.text)
                    .font(.subheadline)
                    .lineLimit(isExpanded ? nil : 3)
                    .multilineTextAlignment(.leading)

                if let score = post.score {
                    Label(score.topStrength, systemImage: "hand.thumbsup.fill")
                        .labelStyle(TakeawayLabelStyle(tint: Theme.accent))
                    Label(score.topWeakness, systemImage: "arrow.down.forward")
                        .labelStyle(TakeawayLabelStyle(tint: .orange))
                } else {
                    Text(post.scoreStatus == .failed ? "We couldn't score this post yet. We'll retry on the next refresh." : "Scoring...")
                        .font(.caption).foregroundStyle(Theme.secondaryText)
                }

                EngagementLine(engagement: post.engagement)
            }
        }
        .contentShape(Rectangle())
    }

    private func suggestions(_ score: ViralityScore) -> some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            Text("How to improve it").font(.headline)
            ForEach(Array(score.suggestions.enumerated()), id: \.offset) { index, suggestion in
                HStack(alignment: .top, spacing: Spacing.small) {
                    Text("\(index + 1)")
                        .font(.caption.weight(.bold)).foregroundStyle(.black)
                        .frame(width: 20, height: 20)
                        .background(Theme.accent, in: Circle())
                    Text(suggestion).font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

private struct TakeawayLabelStyle: LabelStyle {
    let tint: Color

    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            configuration.icon.foregroundStyle(tint).font(.caption2)
            configuration.title.font(.caption).foregroundStyle(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct EngagementLine: View {
    let engagement: PostEngagement

    var body: some View {
        HStack(spacing: Spacing.medium) {
            metric("bubble.left", engagement.replies, "replies")
            metric("arrow.2.squarepath", engagement.reposts, "reposts")
            metric("heart", engagement.likes, "likes")
            if let views = engagement.views { metric("chart.bar", views, "views") }
        }
        .font(.caption.monospacedDigit())
        .foregroundStyle(Theme.secondaryText)
        .padding(.top, 2)
    }

    private func metric(_ icon: String, _ value: Int, _ label: String) -> some View {
        Label(value.formatted(.number.notation(.compactName)), systemImage: icon)
            .labelStyle(.titleAndIcon)
            .accessibilityLabel("\(value) \(label)")
    }
}

// MARK: - Rewrite

private struct RewriteSheet: View {
    let post: ScoredPost
    let username: String
    @Environment(ViralityStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var variants: [String] = []
    @State private var error: String?
    @State private var copiedIndex: Int?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.large) {
                    if let error {
                        ContentUnavailableView("Couldn't rewrite", systemImage: "exclamationmark.bubble", description: Text(error))
                    } else if variants.isEmpty {
                        ProgressView("Writing stronger versions...")
                            .frame(maxWidth: .infinity).padding(.top, 60)
                    } else {
                        ForEach(Array(variants.enumerated()), id: \.offset) { index, variant in
                            SurfaceCard {
                                VStack(alignment: .leading, spacing: Spacing.medium) {
                                    Text("VERSION \(index + 1)")
                                        .font(.caption.weight(.bold)).tracking(1.2)
                                        .foregroundStyle(Theme.accent)
                                    Text(variant).font(.body).textSelection(.enabled)
                                    Button {
                                        UIPasteboard.general.string = variant
                                        copiedIndex = index
                                    } label: {
                                        Label(copiedIndex == index ? "Copied" : "Copy", systemImage: copiedIndex == index ? "checkmark" : "doc.on.doc")
                                            .fontWeight(.semibold)
                                    }
                                    .sensoryFeedback(.success, trigger: copiedIndex)
                                }
                            }
                        }
                    }
                }
                .padding(Spacing.large)
            }
            .background(Theme.background)
            .navigationTitle("Rewrite with AI")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task {
                do {
                    variants = try await store.rewrite(post, username: username)
                } catch {
                    self.error = (error as? LocalizedError)?.errorDescription ?? "Please try again."
                }
            }
        }
    }
}
