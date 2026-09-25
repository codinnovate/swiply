import Foundation
import Testing
@testable import Postlock

struct ViralityDecodingTests {
    private let historyJSON = """
    {
      "username": "sam",
      "scoringAvailable": true,
      "isScoring": false,
      "posts": [{
        "postId": "1", "url": "https://x.com/sam/status/1", "kind": "original",
        "text": "I shipped in 11 days.", "threadTexts": [], "quotedUsername": null, "quotedText": null,
        "postedAt": "2026-09-24T16:41:27.000Z", "mediaType": "image", "isThread": false,
        "threadLength": 1, "linkLocation": "none", "hashtagCount": 0,
        "engagement": { "likes": 3, "reposts": 1, "replies": 2, "quotes": 0, "bookmarks": 4, "views": null,
                        "capturedAt": "2026-09-24T17:00:00.000Z" },
        "scoreStatus": "scored",
        "score": {
          "total_score": 58,
          "breakdown": {
            "hook_strength": { "score": 18, "max": 25, "reasoning": "Specific." },
            "reply_bait": { "score": 9, "max": 25, "reasoning": "No question." },
            "emotional_charge": { "score": 9, "max": 15, "reasoning": "Mild." },
            "format_structure": { "score": 13, "max": 15, "reasoning": "Clean." },
            "niche_consistency": { "score": 8, "max": 10, "reasoning": "On topic." },
            "risk_factors": { "score": -5, "max": 0, "reasoning": "Link." },
            "timing": { "score": 6, "max": 10, "reasoning": "Fine." }
          },
          "top_strength": "Hook.", "top_weakness": "No reply bait.",
          "suggestions": ["Ask a question."]
        },
        "scoredAt": "2026-09-24T16:45:00.000Z"
      }, {
        "postId": "2", "url": "https://x.com/sam/status/2", "kind": "quote", "text": "Wow",
        "threadTexts": [], "postedAt": "2026-09-23T10:00:00Z", "mediaType": "none", "isThread": false,
        "threadLength": 1, "linkLocation": "none", "hashtagCount": 0,
        "engagement": { "likes": 0, "reposts": 0, "replies": 0, "quotes": 0, "bookmarks": 0, "views": 12 },
        "scoreStatus": "pending", "score": null, "scoredAt": null
      }],
      "insights": { "status": "needs_more_posts", "scoredPostCount": 1, "minimumPosts": 10, "insights": [] }
    }
    """

    @Test func decodesHistoryPayload() throws {
        let history = try URLSessionViralityClient.decoder.decode(PostHistory.self, from: Data(historyJSON.utf8))

        #expect(history.posts.count == 2)
        let scored = try #require(history.posts.first?.score)
        #expect(scored.totalScore == 58)
        #expect(scored.orderedCategories.map(\.category) == ScoreCategory.allCases)
        #expect(scored.breakdown["risk_factors"]?.score == -5)
        #expect(history.posts[0].postedAt == Date(timeIntervalSince1970: 1_790_268_087))
        #expect(history.posts[1].scoreStatus == .pending)
        #expect(history.posts[1].score == nil)
        #expect(history.insights.status == .needsMorePosts)
    }

    @Test func decodesLeaderboardPayload() throws {
        let json = """
        {
          "computedAt": "2026-09-24T15:00:00.000Z",
          "window": { "posts": 10, "days": 30, "minimumPosts": 3 },
          "entries": [{ "rank": 1, "username": "growth_guru", "displayName": "Growth Guru",
                        "avatarUrl": "https://pbs.twimg.com/a.jpg", "niche": "Growth", "category": "featured",
                        "avgScore": 71.5, "avgReplies": 12.3, "postsCounted": 10 }],
          "niches": ["Growth"],
          "me": null
        }
        """
        let leaderboard = try URLSessionViralityClient.decoder.decode(Leaderboard.self, from: Data(json.utf8))

        #expect(leaderboard.entries.first?.category == .featured)
        #expect(leaderboard.entries.first?.avgScore == 71.5)
        #expect(leaderboard.me == nil)
    }

    @Test(arguments: [(10.0, true), (50.0, false), (90.0, false)])
    func scoreColorRunsRedToGreen(score: Double, isReddest: Bool) {
        #expect((ScoreColor.color(for: score) == ScoreColor.color(for: 0)) == isReddest)
    }
}
