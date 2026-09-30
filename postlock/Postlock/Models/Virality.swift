import Foundation

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

    var id: String { postId }
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
}

enum LeaderboardFilter: String, CaseIterable, Identifiable, Sendable {
    case all
    case featured
    case users

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: "All"
        case .featured: "Featured"
        case .users: "PostLock users"
        }
    }
}
