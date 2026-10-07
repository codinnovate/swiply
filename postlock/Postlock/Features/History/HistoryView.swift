import SwiftUI
import Charts

struct HistoryView: View {
    @Environment(AppSession.self) private var session
    @Environment(ViralityStore.self) private var store
    @State private var expandedPostID: String?
    @State private var rewriting: ScoredPost?

    private var username: String { session.profile?.username ?? "" }
    private var timezone: String { session.commitment?.timezoneIdentifier ?? TimeZone.current.identifier }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: Spacing.large) {
                    DashboardHeading(title: "Analytics")
                    if let error = store.historyError {
                        Label(error, systemImage: "wifi.exclamationmark")
                            .font(.footnote).foregroundStyle(Theme.danger)
                    }
                    if let history = store.history {
                        content(history)
                    } else if store.isSyncing {
                        ProgressView("Checking your recent posts...")
                            .frame(maxWidth: .infinity).padding(.top, 80)
                    } else {
                        ContentUnavailableView("Your story starts here", systemImage: "chart.xyaxis.line", description: Text("Check your posts to see scores and insights."))
                    }
                }
                .padding(.horizontal, Spacing.large)
                .padding(.bottom, Spacing.huge)
            }
            .background(Theme.background)
            .toolbar(.hidden, for: .navigationBar)
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
            if let xp = history.xp { XPLevelCard(xp: xp, rules: history.xpRules) }
            AnalyticsOverview(posts: history.posts)
            InsightsCard(insights: history.insights)
            HStack {
                Text("Recent posts").font(.headline)
                Spacer()
                Text("\(history.posts.count) posts").font(.caption).foregroundStyle(Theme.secondaryText)
            }.padding(.top, 8)
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

private struct AnalyticsOverview: View {
    let posts: [ScoredPost]
    private var scored: [ScoredPost] { posts.filter { $0.score != nil }.sorted { $0.postedAt < $1.postedAt } }
    private var average: Int { scored.isEmpty ? 0 : scored.compactMap { $0.score?.totalScore }.reduce(0, +) / scored.count }

    var body: some View {
        VStack(spacing: 14) {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Average post score").font(.subheadline).foregroundStyle(Theme.secondaryText)
                            HStack(alignment: .firstTextBaseline, spacing: 4) {
                                Text("\(average)").font(.system(size: 48, weight: .semibold)).tracking(-2)
                                Text("/ 100").foregroundStyle(Theme.secondaryText)
                            }
                        }
                        Spacer()
                        Text("RECENT POSTS").font(.system(size: 9, weight: .bold)).tracking(1)
                            .padding(9).background(Theme.secondarySurface, in: Capsule())
                    }
                    Chart(scored) { post in
                        AreaMark(x: .value("Date", post.postedAt), yStart: .value("Base", 0), yEnd: .value("Score", post.score?.totalScore ?? 0))
                            .foregroundStyle(LinearGradient(colors: [Theme.accent.opacity(0.25), Theme.accent.opacity(0.01)], startPoint: .top, endPoint: .bottom))
                        LineMark(x: .value("Date", post.postedAt), y: .value("Score", post.score?.totalScore ?? 0))
                            .foregroundStyle(Theme.accent).lineStyle(StrokeStyle(lineWidth: 2.5))
                    }
                    .chartYScale(domain: 0...100)
                    .chartYAxis { AxisMarks(position: .leading, values: [0, 50, 100]) }
                    .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisValueLabel(format: .dateTime.month(.abbreviated).day()) } }
                    .frame(height: 135)
                }
            }
            HStack(spacing: 12) {
                metric("Total views", value: posts.compactMap { $0.engagement.views }.reduce(0, +).formatted(.number.notation(.compactName)), icon: "eye")
                metric("Conversations", value: "\(posts.map { $0.engagement.replies }.reduce(0, +))", icon: "bubble.left.and.bubble.right")
            }
        }
    }

    private func metric(_ title: String, value: String, icon: String) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon).foregroundStyle(Theme.mint)
                Text(value).font(.system(size: 25, weight: .semibold))
                Text(title).font(.caption).foregroundStyle(Theme.secondaryText)
            }
        }
    }
}

// MARK: - XP

private struct XPLevelCard: View {
    let xp: AccountXP
    let rules: XPRules?

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("LEVEL").font(.caption.weight(.bold)).tracking(1.2).foregroundStyle(Theme.accent)
                        Text("\(xp.level.level)").font(.system(size: 44, weight: .semibold, design: .rounded))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("\(xp.total.xpFormatted) XP").font(.headline)
                        Text("\(xp.level.xpForNextLevel.xpFormatted) XP to level \(xp.level.level + 1)")
                            .font(.caption).foregroundStyle(Theme.secondaryText)
                    }
                }
                ProgressView(value: xp.level.progress).tint(Theme.accent)
                HStack(spacing: 12) {
                    window("Last 7 days", xp.last7Days)
                    window("Last 30 days", xp.last30Days)
                }
                if let rules {
                    DisclosureGroup("How XP is earned") {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(earningSignals(rules), id: \.key) { signal, weight in
                                HStack {
                                    Text(XPLine(signal: signal, count: 0, weight: weight, xp: 0, availability: "").title)
                                    Spacer()
                                    Text("\(weight.xpFormatted) XP each").monospacedDigit()
                                }
                            }
                            Text(rules.note).foregroundStyle(Theme.secondaryText).padding(.top, 4)
                                .fixedSize(horizontal: false, vertical: true)
                        }.font(.caption).padding(.top, 8)
                    }
                    .font(.caption.weight(.semibold)).tint(Theme.secondaryText)
                }
            }
        }
    }

    /// Only what FxTwitter can actually see, most valuable first.
    private func earningSignals(_ rules: XPRules) -> [(key: String, value: Double)] {
        rules.weights
            .filter { rules.availability[$0.key] != "unavailable" && $0.value > 0 }
            .sorted { $0.value > $1.value }
    }

    private func window(_ title: String, _ value: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("+\(value.xpFormatted) XP").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.mint)
            Text(title).font(.caption2).foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10).background(Theme.secondarySurface, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct XPBreakdownView: View {
    let xp: PostXP
    let predictedScore: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            HStack(alignment: .firstTextBaseline) {
                Text("XP earned").font(.headline)
                Spacer()
                Text("\(xp.xp.xpFormatted) XP").font(.headline).foregroundStyle(Theme.mint)
            }
            if let predictedScore {
                Text("Predicted \(predictedScore)/100 → Actual \(xp.xp.xpFormatted) XP")
                    .font(.caption).foregroundStyle(Theme.secondaryText)
            }
            if xp.duplicateOf != nil {
                Label("Repeats an earlier post, so its XP only counts once.", systemImage: "doc.on.doc")
                    .font(.caption).foregroundStyle(.orange)
            }
            ForEach(xp.breakdown.filter(\.isAvailable), id: \.signal) { line in
                HStack {
                    Text(line.title)
                    Spacer()
                    Text("\(line.count.xpFormatted) × \(line.weight.xpFormatted)").foregroundStyle(Theme.secondaryText)
                    Text(line.xp.xpFormatted).fontWeight(.semibold).frame(minWidth: 48, alignment: .trailing)
                }
                .font(.subheadline.monospacedDigit())
            }
            if xp.history.count > 1 {
                HStack(spacing: 8) {
                    ForEach(xp.history, id: \.milestone) { point in
                        VStack(spacing: 2) {
                            Text(point.xp.xpFormatted).font(.caption.weight(.semibold)).monospacedDigit()
                            Text(point.title).font(.caption2).foregroundStyle(Theme.secondaryText)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 8)
                        .background(Theme.secondarySurface, in: RoundedRectangle(cornerRadius: 10))
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("XP growth: " + xp.history.map { "\($0.title) \($0.xp.xpFormatted)" }.joined(separator: ", "))
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

            if isExpanded, let xp = post.xp {
                Divider().overlay(Color.white.opacity(0.08))
                XPBreakdownView(xp: xp, predictedScore: post.score?.totalScore)
            }
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
                    if let xp = post.xp {
                        Text("+\(xp.xp.xpFormatted) XP")
                            .foregroundStyle(xp.duplicateOf == nil ? Theme.mint : Theme.secondaryText)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(Theme.mint.opacity(0.1), in: Capsule())
                    }
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
            ScrollView(showsIndicators: false) {
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
