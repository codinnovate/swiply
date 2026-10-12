import SwiftUI

/// X's dark ("Lights out") palette, so a post reads the way it does on X.
enum XPalette {
    static let text = Color(red: 231 / 255, green: 233 / 255, blue: 234 / 255)
    static let secondary = Color(red: 113 / 255, green: 118 / 255, blue: 123 / 255)
    static let border = Color(red: 47 / 255, green: 51 / 255, blue: 54 / 255)
    static let outline = Color(red: 83 / 255, green: 100 / 255, blue: 113 / 255)
    static let blue = Color(red: 29 / 255, green: 155 / 255, blue: 240 / 255)
    static let buttonFill = Color(red: 239 / 255, green: 243 / 255, blue: 244 / 255)
}

/// X's timeline formatting rules.
enum XPostFormat {
    /// Long posts are cut here in the timeline, with a "Show more" link.
    static let timelineCharacterLimit = 280

    /// "now", "12s", "5m", "3h", then "Sep 3", or "Sep 3, 2024" outside this year.
    static func timestamp(_ date: Date, now: Date = .now, calendar: Calendar = .current, locale: Locale = .current) -> String {
        let seconds = Int(now.timeIntervalSince(date))
        switch seconds {
        case ..<1: return "now"
        case ..<60: return "\(seconds)s"
        case ..<3_600: return "\(seconds / 60)m"
        case ..<86_400: return "\(seconds / 3_600)h"
        default:
            var style = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).month(.abbreviated).day()
            if !calendar.isDate(date, equalTo: now, toGranularity: .year) { style = style.year() }
            return date.formatted(style)
        }
    }

    /// "999", "1.2K", "12K", "1.2M", "12M". X truncates rather than rounds.
    static func count(_ value: Int) -> String {
        switch value {
        case ..<1_000: "\(value)"
        case ..<10_000: tenths(value, unit: 1_000, suffix: "K")
        case ..<1_000_000: "\(value / 1_000)K"
        case ..<10_000_000: tenths(value, unit: 1_000_000, suffix: "M")
        case ..<1_000_000_000: "\(value / 1_000_000)M"
        default: tenths(value, unit: 1_000_000_000, suffix: "B")
        }
    }

    private static func tenths(_ value: Int, unit: Int, suffix: String) -> String {
        let tenth = value % unit / (unit / 10)
        return tenth == 0 ? "\(value / unit)\(suffix)" : "\(value / unit).\(tenth)\(suffix)"
    }

    /// The post as the timeline shows it: cut on a word boundary past the limit.
    static func timelineText(_ text: String, limit: Int = timelineCharacterLimit) -> (text: String, isTruncated: Bool) {
        guard text.count > limit else { return (text, false) }
        let prefix = text.prefix(limit)
        let cut = prefix.lastIndex(where: \.isWhitespace).map { prefix[..<$0] } ?? prefix
        return (cut.trimmingCharacters(in: .whitespacesAndNewlines) + "…", true)
    }

    private static let entityPattern = try! NSRegularExpression(
        pattern: #"https?://[^\s]*[^\s.,!?:;)\]'"…]|(?<![\w@])@\w{1,15}|(?<![\w#&])#\w*[^\W\d]\w*|(?<![\w$])\$[A-Za-z]{1,6}(?!\w)"#
    )

    /// Links, @mentions, #hashtags and $cashtags, which X draws in blue.
    static func entities(in text: String) -> [String] {
        entityRanges(in: text).map { String(text[$0]) }
    }

    static func entityRanges(in text: String) -> [Range<String.Index>] {
        entityPattern
            .matches(in: text, range: NSRange(text.startIndex..., in: text))
            .compactMap { Range($0.range, in: text) }
    }

    static func attributed(_ text: String) -> AttributedString {
        var result = AttributedString()
        var cursor = text.startIndex
        for range in entityRanges(in: text) {
            result += AttributedString(text[cursor..<range.lowerBound])
            var entity = AttributedString(text[range])
            entity.foregroundColor = XPalette.blue
            result += entity
            cursor = range.upperBound
        }
        result += AttributedString(text[cursor...])
        return result
    }

    /// The post-detail stats line: only nonzero counts, like X.
    static func detailStats(_ engagement: PostEngagement) -> [(count: String, label: String)] {
        [
            (engagement.reposts, "Repost"),
            (engagement.quotes, "Quote"),
            (engagement.likes, "Like"),
            (engagement.bookmarks, "Bookmark"),
        ]
        .filter { $0.0 > 0 }
        .map { (count($0.0), $0.0 == 1 ? $0.1 : $0.1 + "s") }
    }
}

/// Who a post is shown as posted by: the connected X account.
struct XPostAuthor: Equatable {
    let username: String
    let displayName: String
    let avatarURL: URL?
    let isVerified: Bool
    let verificationType: PostingProfile.VerificationType?

    init(profile: PostingProfile?, username: String) {
        let displayName = profile?.displayName.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.username = profile?.username ?? username
        self.displayName = displayName.isEmpty ? (profile?.username ?? username) : displayName
        avatarURL = profile?.avatarURL
        isVerified = profile?.isVerified == true
        verificationType = profile?.verificationType
    }
}

/// A scored post drawn as an X timeline post. Tapping it, or its views
/// count, opens the score and XP breakdown the way X opens post analytics.
struct XPostCard: View {
    let post: ScoredPost
    let author: XPostAuthor
    let isExpanded: Bool
    let toggle: () -> Void
    let rewrite: () -> Void

    @ScaledMetric(relativeTo: .subheadline) private var avatarSize: CGFloat = 40
    @ScaledMetric(relativeTo: .subheadline) private var iconSize: CGFloat = 17

    private var timeline: (text: String, isTruncated: Bool) {
        isExpanded ? (post.text, false) : XPostFormat.timelineText(post.text)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            AvatarView(url: author.avatarURL, displayName: author.displayName, size: avatarSize, showsBorder: false)
            VStack(alignment: .leading, spacing: 2) {
                header
                postText
                actionBar.padding(.top, 10)
                if post.isThread {
                    Link("Show this thread", destination: post.url)
                        .font(.subheadline).foregroundStyle(XPalette.blue)
                        .padding(.top, 10)
                }
                if isExpanded {
                    PostAnalyticsPanel(post: post, rewrite: rewrite)
                        .padding(.top, 12)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, isExpanded ? 16 : 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture(perform: toggle)
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: isExpanded ? "Hide post analytics" : "View post analytics", toggle)
    }

    private var header: some View {
        HStack(spacing: 4) {
            Text(author.displayName)
                .fontWeight(.bold).foregroundStyle(XPalette.text)
                .lineLimit(1).layoutPriority(1)
            if author.isVerified {
                VerificationBadge(type: author.verificationType, size: iconSize - 1)
            }
            Text("@\(author.username)").lineLimit(1)
            Text("·")
            Text(XPostFormat.timestamp(post.postedAt)).fixedSize()
            Spacer(minLength: 8)
            scorePill
            moreMenu
        }
        .font(.subheadline)
        .foregroundStyle(XPalette.secondary)
    }

    @ViewBuilder
    private var scorePill: some View {
        if let score = post.score {
            let color = ScoreColor.color(for: Double(score.totalScore))
            Text("\(score.totalScore)")
                .font(.footnote.weight(.bold)).monospacedDigit()
                .foregroundStyle(color)
                .padding(.horizontal, 7).padding(.vertical, 1)
                .background(color.opacity(0.14), in: Capsule())
                .accessibilityLabel("Virality score \(score.totalScore) out of 100")
        } else if post.scoreStatus == .failed {
            Image(systemName: "exclamationmark.circle")
                .accessibilityLabel("Scoring failed")
        } else {
            ProgressView().controlSize(.mini)
                .accessibilityLabel("Scoring")
        }
    }

    private var moreMenu: some View {
        Menu {
            Button(isExpanded ? "Hide post analytics" : "View post analytics", systemImage: "chart.bar", action: toggle)
            Button("Rewrite with AI", systemImage: "wand.and.stars", action: rewrite)
            Button("Copy link", systemImage: "link") { UIPasteboard.general.url = post.url }
            ShareLink(item: post.url) { Label("Share post via…", systemImage: "square.and.arrow.up") }
            Link(destination: post.url) { Label("Open on X", systemImage: "arrow.up.right") }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: iconSize))
                .frame(width: 28, height: 20)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("More")
    }

    @ViewBuilder
    private var postText: some View {
        Text(XPostFormat.attributed(timeline.text))
            .font(.subheadline)
            .foregroundStyle(XPalette.text)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
        if timeline.isTruncated {
            Text("Show more").font(.subheadline).foregroundStyle(XPalette.blue)
        }
    }

    private var actionBar: some View {
        HStack(spacing: 0) {
            action("bubble.left", post.engagement.replies, "replies")
            action("arrow.2.squarepath", post.engagement.reposts, "reposts")
            action("heart", post.engagement.likes, "likes")
            Button(action: toggle) {
                action(post.engagement.views ?? 0, "views") {
                    XViewsIcon().frame(width: iconSize, height: iconSize)
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint(isExpanded ? "Hides post analytics" : "Shows post analytics")
            HStack(spacing: 16) {
                Image(systemName: "bookmark").accessibilityLabel("\(post.engagement.bookmarks) bookmarks")
                ShareLink(item: post.url) {
                    Image(systemName: "square.and.arrow.up").accessibilityLabel("Share post")
                }
            }
        }
        .font(.system(size: iconSize))
        .foregroundStyle(XPalette.secondary)
    }

    private func action(_ icon: String, _ value: Int, _ label: String) -> some View {
        action(value, label) { Image(systemName: icon) }
    }

    private func action(_ value: Int, _ label: String, @ViewBuilder icon: () -> some View) -> some View {
        HStack(spacing: 4) {
            icon()
            if value > 0 {
                Text(XPostFormat.count(value)).font(.footnote).monospacedDigit()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) \(label)")
    }
}

/// X's views glyph: four bars on its 24-point grid. SF Symbols has no match.
private struct XViewsIcon: View {
    var body: some View {
        Canvas { context, size in
            let unit = min(size.width, size.height) / 24
            let bars: [(x: CGFloat, top: CGFloat)] = [(4, 11), (8.75, 3), (13.25, 14), (18, 8.5)]
            for bar in bars {
                let rect = CGRect(x: bar.x * unit, y: bar.top * unit, width: 2 * unit, height: (21 - bar.top) * unit)
                context.fill(Path(rect), with: .foreground)
            }
        }
        .accessibilityHidden(true)
    }
}

/// The score, XP and advice for a post, framed like an X quoted post.
private struct PostAnalyticsPanel: View {
    let post: ScoredPost
    let rewrite: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Post analytics").font(.subheadline.weight(.bold)).foregroundStyle(XPalette.text)
            stats
            scoreSummary
            if let xp = post.xp {
                divider
                XPBreakdownView(xp: xp, predictedScore: post.score?.totalScore)
            }
            if let score = post.score {
                divider
                ScoreBreakdownView(score: score)
                suggestions(score)
            }
            buttons.padding(.top, 2)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(XPalette.border, lineWidth: 1) }
        .contentShape(Rectangle())
        .onTapGesture {}
    }

    private var divider: some View {
        Rectangle().fill(XPalette.border).frame(height: 1)
    }

    @ViewBuilder
    private var stats: some View {
        let stats = XPostFormat.detailStats(post.engagement)
        if !stats.isEmpty {
            Text(stats.enumerated().reduce(into: AttributedString()) { line, item in
                if item.offset > 0 { line += AttributedString("   ") }
                var count = AttributedString(item.element.count)
                count.font = .subheadline.bold()
                count.foregroundColor = XPalette.text
                var label = AttributedString(" \(item.element.label)")
                label.foregroundColor = XPalette.secondary
                line += count + label
            })
            .font(.subheadline)
        }
    }

    @ViewBuilder
    private var scoreSummary: some View {
        HStack(alignment: .top, spacing: Spacing.medium) {
            if let score = post.score {
                ScoreBadge(score: Double(score.totalScore), size: 44, lineWidth: 4)
            } else {
                PendingScoreBadge(failed: post.scoreStatus == .failed, size: 44)
            }
            VStack(alignment: .leading, spacing: 6) {
                if let score = post.score {
                    Label(score.topStrength, systemImage: "hand.thumbsup.fill")
                        .labelStyle(TakeawayLabelStyle(tint: Theme.accent))
                    Label(score.topWeakness, systemImage: "arrow.down.forward")
                        .labelStyle(TakeawayLabelStyle(tint: .orange))
                } else {
                    Text(post.scoreStatus == .failed ? "We couldn't score this post yet. We'll retry on the next refresh." : "Scoring...")
                        .font(.caption).foregroundStyle(XPalette.secondary)
                }
            }
        }
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

    /// X's pill buttons: a filled primary and an outlined secondary.
    private var buttons: some View {
        HStack(spacing: Spacing.small) {
            Button(action: rewrite) {
                Label("Rewrite with AI", systemImage: "wand.and.stars")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity).frame(minHeight: 36)
                    .background(XPalette.buttonFill, in: Capsule())
            }
            Link(destination: post.url) {
                Text("Open on X")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(XPalette.buttonFill)
                    .padding(.horizontal, 16).frame(minHeight: 36)
                    .overlay { Capsule().stroke(XPalette.outline, lineWidth: 1) }
            }
        }
        .buttonStyle(.plain)
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
