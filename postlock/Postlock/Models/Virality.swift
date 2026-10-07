import Foundation

struct PostSuggestion: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let topic: String
    let draft: String
    let whyNow: String
    let angle: String
    let sourceUrls: [URL]
}

struct PostSuggestions: Codable, Sendable {
    let generatedAt: Date
    let niche: String
    let ideas: [PostSuggestion]

    static func preview(niche: String) -> Self {
        .init(generatedAt: .now, niche: niche.isEmpty ? "Building in public" : niche, ideas: [
            .init(id: "preview-1", title: "Show the messy middle", topic: "Behind the scenes", draft: "The part of [your project] nobody sees: [one honest challenge]. Here's the small change that helped: [your lesson]. What's been your hardest part?", whyNow: "Sample idea, not a live trend. A specific lesson gives readers something useful to respond to.", angle: "Share one real screenshot and a concrete decision. Replace the placeholders with your own experience.", sourceUrls: []),
            .init(id: "preview-2", title: "Challenge a familiar rule", topic: "A fresh perspective", draft: "Everyone says [common advice in your niche]. But when [specific situation], I'd try [your alternative]. What has worked for you?", whyNow: "Sample idea, not a live trend. A nuanced counterpoint can start a thoughtful conversation.", angle: "Explain when the advice fails. Keep the claim grounded in something you can demonstrate.", sourceUrls: []),
            .init(id: "preview-3", title: "Give away a tiny playbook", topic: "Useful in 60 seconds", draft: "A simple way to [solve a problem]:\n1. [First action]\n2. [Second action]\n3. [Final action]\nWhich step would you add?", whyNow: "Sample idea, not a live trend. Practical steps give your audience something to use and discuss.", angle: "Choose one problem in your niche. Keep each step specific enough to act on today.", sourceUrls: [])
        ])
    }
}

/// Local presentation fixtures. Never written to the API or account history.
enum DesignPreviewData {
    static var enabledByDefault: Bool {
        #if DEBUG && targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    private static func previewXP(likes: Int, reposts: Int, replies: Int, replyBacks: Int, postedAt: Date) -> PostXP {
        let lines = [
            XPLine(signal: "like", count: Double(likes), weight: 0.5, xp: Double(likes) * 0.5, availability: "measured"),
            XPLine(signal: "repost", count: Double(reposts), weight: 1, xp: Double(reposts), availability: "measured"),
            XPLine(signal: "replyReceived", count: Double(replies), weight: 13.5, xp: Double(replies) * 13.5, availability: "measured"),
            XPLine(signal: "authorReplyToReply", count: Double(replyBacks), weight: 75, xp: Double(replyBacks) * 75, availability: "partial"),
            XPLine(signal: "profileClickToEngagement", count: 0, weight: 12, xp: 0, availability: "unavailable"),
            XPLine(signal: "conversationClickEngagement", count: 0, weight: 11, xp: 0, availability: "unavailable"),
        ]
        let total = lines.map(\.xp).reduce(0, +)
        return PostXP(xp: total, earnedXp: total, penaltyXp: 0, breakdown: lines, duplicateOf: nil, history: [
            XPHistoryPoint(milestone: "h1", capturedAt: postedAt.addingTimeInterval(3600), xp: (total * 0.3).rounded()),
            XPHistoryPoint(milestone: "h24", capturedAt: postedAt.addingTimeInterval(86400), xp: (total * 0.85).rounded()),
            XPHistoryPoint(milestone: "latest", capturedAt: .now, xp: total),
        ].filter { $0.capturedAt <= .now })
    }

    static let leaderboard = Leaderboard(computedAt: .now, window: .init(posts: 10, days: 30, minimumPosts: 3), entries: [
        entry(1, "Elon Musk", "elonmusk", 41, .featured),
        entry(2, "Pieter Levels", "levelsio", 33, .featured),
        entry(3, "Marc Lou", "marclou", 29, .featured),
        entry(4, "Kai Morgan", "kaimakes", 24, .user),
        entry(5, "Jacob Rodriguez", "jacobrodri_", 21, .featured),
        entry(6, "Sofia Park", "sofiaspaces", 18, .user)
    ], niches: [], me: nil)

    static let xpRules = XPRules(
        version: 0,
        weights: ["like": 0.5, "repost": 1, "replyReceived": 13.5, "profileClickToEngagement": 12, "conversationClickEngagement": 11, "authorReplyToReply": 75, "mutedOrBlocked": -74, "reported": -369],
        availability: ["like": "measured", "repost": "measured", "replyReceived": "measured", "authorReplyToReply": "partial", "profileClickToEngagement": "unavailable", "conversationClickEngagement": "unavailable", "mutedOrBlocked": "unavailable", "reported": "unavailable"],
        note: "XP reflects likes, reposts, replies, and your replies back to people who replied. Profile-click, conversation-click, mute, block, and report data isn't public, so those count as zero.",
        levelBaseXp: 50, replierDecayWindowDays: 30, duplicateWindowDays: 7)

    /// A sample breakdown for a sample leaderboard entry; its XP is the sum of its posts.
    static func breakdown(for entry: LeaderboardEntry, period: LeaderboardFilter) -> LeaderboardBreakdown {
        let samples: [(text: String, quote: (String, String)?, hoursAgo: Double, likes: Int, reposts: Int, replies: Int, replyBacks: Int, views: Int)] = [
            ("Shipped the new onboarding today. Cut it from 6 screens to 2 and signups are already up.", nil, 2, 184, 21, 36, 4, 12_400),
            ("What's one tool you'd never build yourself?", nil, 6, 96, 8, 58, 6, 8_900),
            ("This is the way.", ("indiehacker", "Nobody cares about your tech stack. Ship the thing and talk to users."), 11, 240, 33, 19, 1, 21_300),
            ("Small daily progress beats the occasional heroic sprint. Every time.", nil, 19, 131, 17, 22, 2, 9_700),
        ]
        let posts = samples.enumerated().map { index, sample in
            let postedAt = Date.now.addingTimeInterval(-sample.hoursAgo * 3600)
            return LeaderboardBreakdown.Post(
                postId: "sample-\(entry.username)-\(index)", url: URL(string: "https://x.com/\(entry.username)")!,
                kind: sample.quote == nil ? "original" : "quote", text: sample.text, threadTexts: [],
                quotedUsername: sample.quote?.0, quotedText: sample.quote?.1, postedAt: postedAt, mediaType: "none",
                engagement: PostEngagement(likes: sample.likes, reposts: sample.reposts, replies: sample.replies, quotes: 2, bookmarks: 9, views: sample.views),
                xp: previewXP(likes: sample.likes, reposts: sample.reposts, replies: sample.replies, replyBacks: sample.replyBacks, postedAt: postedAt))
        }
        return LeaderboardBreakdown(
            computedAt: .now, period: period, username: entry.username, displayName: entry.displayName,
            avatarUrl: entry.avatarUrl, category: entry.category, level: entry.level ?? 1,
            xp: posts.compactMap(\.xp?.xp).reduce(0, +), postsCounted: posts.count, xpRules: xpRules, posts: posts)
    }

    private static func entry(_ rank: Int, _ name: String, _ handle: String, _ posts: Int, _ category: LeaderboardEntry.Category) -> LeaderboardEntry {
        .init(rank: rank, username: handle, displayName: name, avatarUrl: nil, niche: "Building in public", category: category, avgScore: Double(70 + rank), avgReplies: Double(42 - rank * 4), postsCounted: posts, xp: Double(posts * 180), level: Int(Double(posts * 180 / 50).squareRoot()) + 1)
    }
}

/// A post's virality score, in the scoring engine's JSON shape.
struct ViralityScore: Codable, Equatable, Sendable {
    let totalScore: Int
    let breakdown: [String: CategoryScore]
    let topStrength: String
    let topWeakness: String
    let suggestions: [String]

    enum CodingKeys: String, CodingKey {
        case totalScore = "total_score"
        case breakdown
        case topStrength = "top_strength"
        case topWeakness = "top_weakness"
        case suggestions
    }

    /// Breakdown rows in display order, skipping any category the server didn't send.
    var orderedCategories: [(category: ScoreCategory, score: CategoryScore)] {
        ScoreCategory.allCases.compactMap { category in
            breakdown[category.rawValue].map { (category, $0) }
        }
    }
}

struct CategoryScore: Codable, Equatable, Sendable {
    let score: Int
    let max: Int
    let reasoning: String
}

enum ScoreCategory: String, CaseIterable, Sendable {
    case hookStrength = "hook_strength"
    case replyBait = "reply_bait"
    case emotionalCharge = "emotional_charge"
    case formatStructure = "format_structure"
    case nicheConsistency = "niche_consistency"
    case timing
    case riskFactors = "risk_factors"

    var title: String {
        switch self {
        case .hookStrength: "Hook"
        case .replyBait: "Reply-bait"
        case .emotionalCharge: "Emotion"
        case .formatStructure: "Format"
        case .nicheConsistency: "Niche fit"
        case .timing: "Timing"
        case .riskFactors: "Risk"
        }
    }

    /// Risk factors subtract from the total, down to this floor.
    static let riskFloor = -20
}

struct PostEngagement: Codable, Equatable, Sendable {
    let likes: Int
    let reposts: Int
    let replies: Int
    let quotes: Int
    let bookmarks: Int
    let views: Int?
}

struct ScoredPost: Codable, Equatable, Identifiable, Sendable {
    enum ScoreStatus: String, Codable, Sendable {
        case pending, scored, failed
    }

    let postId: String
    let url: URL
    let text: String
    let threadTexts: [String]
    let postedAt: Date
    let mediaType: String
    let isThread: Bool
    let threadLength: Int
    let linkLocation: String
    let hashtagCount: Int
    let engagement: PostEngagement
    let scoreStatus: ScoreStatus
    let score: ViralityScore?
    /// What the post actually earned; absent from servers older than XP.
    var xp: PostXP? = nil

    var id: String { postId }
}

// MARK: - XP

/// One weighted signal in a post's XP. Weights come from the server's XP
/// config, never the app, so they can be retuned without a release.
struct XPLine: Codable, Equatable, Sendable {
    let signal: String
    let count: Double
    let weight: Double
    let xp: Double
    let availability: String

    /// FxTwitter can't see it, so it's counted as zero.
    var isAvailable: Bool { availability != "unavailable" }

    var title: String {
        switch signal {
        case "like": "Likes"
        case "repost": "Reposts"
        case "replyReceived": "Replies"
        case "authorReplyToReply": "Your replies back"
        case "profileClickToEngagement": "Profile clicks"
        case "conversationClickEngagement": "Conversation clicks"
        case "mutedOrBlocked": "Mutes & blocks"
        case "reported": "Reports"
        default: signal
        }
    }
}

struct XPHistoryPoint: Codable, Equatable, Sendable {
    let milestone: String
    let capturedAt: Date
    let xp: Double

    var title: String {
        switch milestone {
        case "h1": "1h"
        case "h24": "24h"
        case "d7": "7d"
        default: "Now"
        }
    }
}

struct PostXP: Codable, Equatable, Sendable {
    let xp: Double
    let earnedXp: Double
    /// Raw penalties, shown for context; a post's XP never drops below zero.
    let penaltyXp: Double
    let breakdown: [XPLine]
    /// Set when this repeats a post that already earned the XP.
    let duplicateOf: String?
    let history: [XPHistoryPoint]
}

struct XPLevel: Codable, Equatable, Sendable {
    let level: Int
    let levelStartXp: Double
    let nextLevelXp: Double
    let xpIntoLevel: Double
    let xpForNextLevel: Double

    var progress: Double {
        let span = nextLevelXp - levelStartXp
        return span > 0 ? min(1, max(0, xpIntoLevel / span)) : 0
    }
}

struct AccountXP: Codable, Equatable, Sendable {
    let total: Double
    let last7Days: Double
    let last30Days: Double
    let level: XPLevel
}

struct XPRules: Codable, Equatable, Sendable {
    let version: Int
    let weights: [String: Double]
    let availability: [String: String]
    let note: String
    let levelBaseXp: Double
    /// A repeat replier answered again within this window counts ½, then ⅓, …
    var replierDecayWindowDays: Double? = nil
    /// Reposting the same text within this window earns XP once.
    var duplicateWindowDays: Double? = nil
}

extension Double {
    /// XP as shown in the app: whole numbers stay whole, large ones compact.
    var xpFormatted: String {
        formatted(.number.notation(.compactName).precision(.fractionLength(0...1)))
    }
}

struct PostInsight: Codable, Equatable, Identifiable, Sendable {
    enum Kind: String, Codable, Sendable {
        case weakness, opportunity, warning
    }

    let id: String
    let kind: Kind
    let title: String
    let message: String
}

struct PostInsights: Codable, Equatable, Sendable {
    enum Status: String, Codable, Sendable {
        case ready
        case needsMorePosts = "needs_more_posts"
    }

    let status: Status
    let scoredPostCount: Int
    let minimumPosts: Int
    let insights: [PostInsight]
}

struct PostHistory: Codable, Equatable, Sendable {
    let username: String
    let scoringAvailable: Bool
    let isScoring: Bool
    let posts: [ScoredPost]
    let insights: PostInsights
    var xp: AccountXP? = nil
    var xpRules: XPRules? = nil
}

struct RewriteResult: Codable, Sendable {
    let variants: [String]
}

struct LeaderboardEntry: Codable, Equatable, Identifiable, Sendable {
    enum Category: String, Codable, Sendable {
        case featured, user
    }

    let rank: Int
    let username: String
    let displayName: String
    let avatarUrl: URL?
    let niche: String?
    let category: Category
    let avgScore: Double
    let avgReplies: Double
    let postsCounted: Int
    /// XP earned in the requested period; what the ranking is ordered by.
    var xp: Double? = nil
    /// Level from all-time XP.
    var level: Int? = nil

    var id: String { username }
}

struct Leaderboard: Codable, Equatable, Sendable {
    struct Window: Codable, Equatable, Sendable {
        let posts: Int
        let days: Int
        let minimumPosts: Int
    }

    let computedAt: Date
    let window: Window
    let entries: [LeaderboardEntry]
    let niches: [String]
    let me: LeaderboardEntry?
    var xpRules: XPRules? = nil
}

/// Which period to rank by. Sent to the server as `period`; the server
/// re-ranks and returns each account's XP for that period as `xp`.
enum LeaderboardFilter: String, CaseIterable, Identifiable, Codable, Sendable {
    case day
    case week
    case all

    var id: String { rawValue }

    var title: String {
        switch self {
        case .day: "Daily"
        case .week: "Weekly"
        case .all: "All time"
        }
    }

    /// The span as a phrase: "Last 24 hours".
    var spanTitle: String {
        switch self {
        case .day: "Last 24 hours"
        case .week: "Last 7 days"
        case .all: "All time"
        }
    }
}

/// How one ranked account's XP for a period adds up, post by post. Computed
/// as of the ranking's snapshot, so `xp` matches the leaderboard.
struct LeaderboardBreakdown: Codable, Equatable, Sendable {
    struct Post: Codable, Equatable, Identifiable, Sendable {
        let postId: String
        let url: URL
        /// "original" or "quote".
        let kind: String
        let text: String
        let threadTexts: [String]
        let quotedUsername: String?
        let quotedText: String?
        let postedAt: Date
        let mediaType: String
        let engagement: PostEngagement
        let xp: PostXP?

        var id: String { postId }
    }

    let computedAt: Date
    let period: LeaderboardFilter
    let username: String
    let displayName: String
    let avatarUrl: URL?
    let category: LeaderboardEntry.Category
    let level: Int
    let xp: Double
    /// Every post in the period; `posts` lists at most the newest 100.
    let postsCounted: Int
    let xpRules: XPRules
    let posts: [Post]
}
