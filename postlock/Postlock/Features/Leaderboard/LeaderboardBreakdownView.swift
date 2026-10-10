import SwiftUI

/// How a ranked account's XP adds up: the weights, then every post in the
/// period as a tweet-style card with its own calculation.
struct LeaderboardBreakdownSheet: View {
    let entry: LeaderboardEntry
    let period: LeaderboardFilter

    @Environment(ViralityStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var breakdown: LeaderboardBreakdown?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    if let breakdown {
                        BreakdownHeader(breakdown: breakdown)
                        XPRulesCard(rules: breakdown.xpRules)
                        posts(breakdown)
                    } else if let error {
                        VStack(spacing: 12) {
                            Image(systemName: "wifi.exclamationmark").font(.title2).foregroundStyle(Theme.secondaryText)
                            Text(error).font(.subheadline).foregroundStyle(Theme.secondaryText).multilineTextAlignment(.center)
                            Button("Try again") { Task { await load() } }.frame(minHeight: 44)
                        }.frame(maxWidth: .infinity).padding(.vertical, 60)
                    } else {
                        ProgressView().tint(Theme.accent).frame(maxWidth: .infinity).padding(.vertical, 80)
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 32)
            }
            .background(Theme.background)
            .navigationTitle("XP breakdown")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .tint(Theme.accent)
        .task { await load() }
    }

    @ViewBuilder
    private func posts(_ breakdown: LeaderboardBreakdown) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Posts").font(.headline)
            Spacer()
            Text(breakdown.postsCounted > breakdown.posts.count
                 ? "Newest \(breakdown.posts.count) of \(breakdown.postsCounted)"
                 : "\(breakdown.postsCounted) \(breakdown.postsCounted == 1 ? "post" : "posts")")
                .font(.caption).foregroundStyle(Theme.secondaryText)
        }
        if breakdown.posts.isEmpty {
            ContentUnavailableView(
                "No posts in this period",
                systemImage: "text.bubble",
                description: Text("Posts published in the \(breakdown.period.spanTitle.lowercased()) show up here with the XP they earned.")
            )
        } else {
            ForEach(breakdown.posts) { post in
                TweetXPCard(post: post, author: breakdown)
            }
        }
    }

    private func load() async {
        error = nil
        do {
            breakdown = try await store.leaderboardBreakdown(username: entry.username, period: period)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Header

private struct BreakdownHeader: View {
    let breakdown: LeaderboardBreakdown

    var body: some View {
        VStack(spacing: 14) {
            AvatarView(url: breakdown.avatarUrl, displayName: breakdown.displayName, size: 72)
            VStack(spacing: 4) {
                Text(breakdown.displayName).font(.title3.weight(.semibold))
                HStack(spacing: 6) {
                    Text("@\(breakdown.username)")
                    Text("LV \(breakdown.level)").fontWeight(.bold).foregroundStyle(Theme.accent)
                }.font(.subheadline).foregroundStyle(Theme.secondaryText)
            }
            VStack(spacing: 2) {
                Text("\(breakdown.xp.xpFormatted) XP")
                    .font(.system(size: 40, weight: .semibold, design: .rounded)).tracking(-1)
                    .foregroundStyle(Theme.accent)
                Text("\(breakdown.period.spanTitle) · sum of every post's XP below")
                    .font(.caption).foregroundStyle(Theme.secondaryText)
                Text("As of \(breakdown.computedAt.formatted(.relative(presentation: .named)))")
                    .font(.caption2).foregroundStyle(Theme.secondaryText)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Rules

/// Every weight the server applies, including signals FxTwitter can't see.
private struct XPRulesCard: View {
    let rules: XPRules

    private var signals: [(signal: String, weight: Double)] {
        rules.weights.map { ($0.key, $0.value) }.sorted { $0.weight > $1.weight }
    }

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("How XP is calculated").font(.headline)
                Text("Each post earns count × weight for every signal below. A post's XP never drops below zero, and an account's XP is the sum of its posts.")
                    .font(.caption).foregroundStyle(Theme.secondaryText)
                VStack(spacing: 0) {
                    ForEach(signals, id: \.signal) { item in
                        let line = XPLine(signal: item.signal, count: 0, weight: item.weight, xp: 0, availability: rules.availability[item.signal] ?? "measured")
                        HStack(spacing: 8) {
                            Text(line.title).font(.subheadline)
                            AvailabilityBadge(availability: line.availability)
                            Spacer(minLength: 4)
                            Text("\(item.weight > 0 ? "+" : "")\(item.weight.xpFormatted) each")
                                .font(.subheadline.weight(.semibold)).monospacedDigit()
                                .foregroundStyle(item.weight < 0 ? Theme.danger : line.isAvailable ? Theme.mint : Theme.secondaryText)
                        }
                        .padding(.vertical, 9)
                        .opacity(line.isAvailable ? 1 : 0.6)
                        .accessibilityElement(children: .combine)
                        if item.signal != signals.last?.signal { Divider().overlay(.white.opacity(0.05)) }
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    rule("arrow.uturn.left", "The author's own replies under a post don't count as replies received.")
                    if let days = rules.replierDecayWindowDays {
                        rule("person.2", "Replying back to the same person again within \(days.xpFormatted) days counts ½, then ⅓, and so on.")
                    }
                    if let days = rules.duplicateWindowDays {
                        rule("doc.on.doc", "Posting the same text again within \(days.xpFormatted) days earns XP only once.")
                    }
                }
                Text(rules.note).font(.caption2).foregroundStyle(Theme.secondaryText)
            }
        }
    }

    private func rule(_ icon: String, _ text: String) -> some View {
        Label { Text(text) } icon: { Image(systemName: icon).foregroundStyle(Theme.accent) }
            .font(.caption).foregroundStyle(Theme.secondaryText)
    }
}

private struct AvailabilityBadge: View {
    let availability: String

    var body: some View {
        switch availability {
        case "partial": badge("PARTIAL", Theme.accent)
        case "unavailable": badge("NOT PUBLIC", Theme.secondaryText)
        default: EmptyView()
        }
    }

    private func badge(_ title: String, _ color: Color) -> some View {
        Text(title).font(.system(size: 8, weight: .bold)).tracking(0.6)
            .padding(.horizontal, 6).padding(.vertical, 3)
            .foregroundStyle(color).background(color.opacity(0.12), in: Capsule())
    }
}

// MARK: - Tweet card

private struct TweetXPCard: View {
    let post: LeaderboardBreakdown.Post
    let author: LeaderboardBreakdown
    @State private var showsCalculation = false
    @State private var showsFullText = false

    /// Past X's own tweet length, the text is clipped behind "Show more" like on X.
    private var isLong: Bool { post.text.count > 280 }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                AvatarView(url: author.avatarUrl, displayName: author.displayName, size: 40)
                VStack(alignment: .leading, spacing: 6) {
                    byline
                    Text(post.text).font(.system(size: 15)).fixedSize(horizontal: false, vertical: true)
                        .lineLimit(isLong && !showsFullText ? 6 : nil)
                    if isLong {
                        Button(showsFullText ? "Show less" : "Show more") { showsFullText.toggle() }
                            .font(.system(size: 15)).foregroundStyle(Theme.accent).buttonStyle(.plain)
                    }
                    if !post.threadTexts.isEmpty {
                        Label("Thread · \(post.threadTexts.count + 1) posts", systemImage: "text.line.first.and.arrowtriangle.forward")
                            .font(.caption).foregroundStyle(Theme.secondaryText)
                    }
                    if let quoted = post.quotedText, !quoted.isEmpty { quote(quoted) }
                    if let media = mediaLabel {
                        Label(media.title, systemImage: media.icon)
                            .font(.caption).foregroundStyle(Theme.secondaryText)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(Theme.secondarySurface, in: Capsule())
                    }
                    engagementRow.padding(.top, 2)
                }
            }
            if let xp = post.xp {
                Divider().overlay(.white.opacity(0.06))
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { showsCalculation.toggle() }
                } label: {
                    HStack {
                        Text("+\(xp.xp.xpFormatted) XP").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.mint)
                        Spacer()
                        Text(showsCalculation ? "Hide calculation" : "See calculation").font(.caption)
                        Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
                            .rotationEffect(.degrees(showsCalculation ? 180 : 0))
                    }
                    .foregroundStyle(Theme.secondaryText).frame(minHeight: 32).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(xp.xp.xpFormatted) XP")
                .accessibilityHint(showsCalculation ? "Hides the calculation" : "Shows how this post's XP was calculated")
                if showsCalculation { XPBreakdownView(xp: xp, predictedScore: nil) }
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
        .overlay { RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.06), lineWidth: 1) }
    }

    private var byline: some View {
        HStack(spacing: 4) {
            Text(author.displayName).font(.system(size: 15, weight: .bold)).lineLimit(1)
            Text("@\(author.username) · \(post.postedAt.tweetAge)")
                .font(.system(size: 15)).foregroundStyle(Theme.secondaryText).lineLimit(1)
            Spacer(minLength: 4)
            Link(destination: post.url) {
                Image(systemName: "arrow.up.right").font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText).frame(width: 32, height: 32)
            }.accessibilityLabel("Open post on X")
        }
    }

    private func quote(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if let handle = post.quotedUsername, !handle.isEmpty {
                Text("@\(handle)").font(.system(size: 13, weight: .bold))
            }
            Text(text).font(.system(size: 14)).lineLimit(5).foregroundStyle(.white.opacity(0.85))
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .overlay { RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.12), lineWidth: 1) }
    }

    private var engagementRow: some View {
        HStack(spacing: 0) {
            stat("bubble.left", post.engagement.replies, "replies")
            stat("arrow.2.squarepath", post.engagement.reposts, "reposts")
            stat("heart", post.engagement.likes, "likes")
            if let views = post.engagement.views { stat("chart.bar", views, "views") }
        }
        .font(.system(size: 13)).foregroundStyle(Theme.secondaryText)
    }

    private func stat(_ icon: String, _ value: Int, _ label: String) -> some View {
        Label(Double(value).xpFormatted, systemImage: icon)
            .labelStyle(TweetStatLabelStyle())
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel("\(value) \(label)")
    }

    private var mediaLabel: (title: String, icon: String)? {
        switch post.mediaType {
        case "image": ("Photo", "photo")
        case "video": ("Video", "play.rectangle")
        case "gif": ("GIF", "sparkles.rectangle.stack")
        default: nil
        }
    }
}

private struct TweetStatLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 5) { configuration.icon; configuration.title.monospacedDigit() }
    }
}

private extension Date {
    /// Compact age the way X shows it: 45s, 12m, 3h, then a date.
    var tweetAge: String {
        let seconds = max(0, Date.now.timeIntervalSince(self))
        switch seconds {
        case ..<60: return "\(Int(seconds))s"
        case ..<3600: return "\(Int(seconds / 60))m"
        case ..<86_400: return "\(Int(seconds / 3600))h"
        default: return formatted(.dateTime.month(.abbreviated).day())
        }
    }
}
