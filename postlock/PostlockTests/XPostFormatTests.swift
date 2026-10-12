import Foundation
import Testing
@testable import Postlock

struct XPostFormatTests {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()
    private let locale = Locale(identifier: "en_US")
    private let now = ISO8601DateFormatter().date(from: "2026-09-26T12:00:00Z")!

    private func timestamp(secondsAgo: TimeInterval) -> String {
        XPostFormat.timestamp(now.addingTimeInterval(-secondsAgo), now: now, calendar: calendar, locale: locale)
    }

    @Test(arguments: [
        (0.0, "now"),
        (-30.0, "now"),
        (12.0, "12s"),
        (59.0, "59s"),
        (60.0, "1m"),
        (3_599.0, "59m"),
        (3_600.0, "1h"),
        (86_399.0, "23h"),
    ])
    func recentPostsUseShortRelativeTime(secondsAgo: TimeInterval, expected: String) {
        #expect(timestamp(secondsAgo: secondsAgo) == expected)
    }

    @Test func olderPostsThisYearShowMonthAndDay() {
        #expect(timestamp(secondsAgo: 86_400 * 23) == "Sep 3")
    }

    @Test func postsFromAnotherYearIncludeTheYear() {
        let date = ISO8601DateFormatter().date(from: "2025-12-31T09:00:00Z")!
        #expect(XPostFormat.timestamp(date, now: now, calendar: calendar, locale: locale) == "Dec 31, 2025")
    }

    @Test(arguments: [
        (0, "0"),
        (999, "999"),
        (1_000, "1K"),
        (1_234, "1.2K"),
        (1_299, "1.2K"),
        (9_999, "9.9K"),
        (10_000, "10K"),
        (12_345, "12K"),
        (999_999, "999K"),
        (1_000_000, "1M"),
        (1_560_000, "1.5M"),
        (12_000_000, "12M"),
        (2_300_000_000, "2.3B"),
    ])
    func countsMatchXCompactFormat(value: Int, expected: String) {
        #expect(XPostFormat.count(value) == expected)
    }

    @Test func shortPostsAreShownWhole() {
        let text = String(repeating: "a", count: 280)
        #expect(XPostFormat.timelineText(text) == (text, false))
    }

    @Test func longPostsAreCutOnAWordBoundary() {
        let text = String(repeating: "word ", count: 80)
        let result = XPostFormat.timelineText(text)
        #expect(result.isTruncated)
        #expect(result.text.hasSuffix("word…"))
        #expect(result.text.count <= XPostFormat.timelineCharacterLimit + 1)
    }

    @Test func longPostsWithoutSpacesAreCutAtTheLimit() {
        let result = XPostFormat.timelineText(String(repeating: "a", count: 300))
        #expect(result.text == String(repeating: "a", count: 280) + "…")
    }

    @Test func findsMentionsHashtagsCashtagsAndLinks() {
        let text = "Shipped it with @jack_dorsey #buildinpublic $TSLA https://example.com/a?b=1. email me@site.com #1 C#"
        #expect(XPostFormat.entities(in: text) == ["@jack_dorsey", "#buildinpublic", "$TSLA", "https://example.com/a?b=1"])
    }

    @Test func attributedTextKeepsEveryCharacter() {
        let text = "Hi @sam, see #swift!"
        #expect(String(XPostFormat.attributed(text).characters) == text)
    }

    @Test func detailStatsSkipZerosAndPluralize() {
        let engagement = PostEngagement(likes: 1_234, reposts: 1, replies: 9, quotes: 0, bookmarks: 3, views: 50_000)
        let stats = XPostFormat.detailStats(engagement)
        #expect(stats.map(\.count) == ["1", "1.2K", "3"])
        #expect(stats.map(\.label) == ["Repost", "Likes", "Bookmarks"])
    }

    @Test func authorFallsBackToUsernameWithoutAProfile() {
        let author = XPostAuthor(profile: nil, username: "samuel")
        #expect(author.displayName == "samuel")
        #expect(author.username == "samuel")
        #expect(!author.isVerified)
    }

    @Test func authorUsesTheConnectedProfile() {
        let profile = PostingProfile(
            username: "samuel", displayName: "Samuel", avatarURL: nil,
            isPublic: true, isVerified: true, verificationType: .individual
        )
        let author = XPostAuthor(profile: profile, username: "ignored")
        #expect(author.displayName == "Samuel")
        #expect(author.username == "samuel")
        #expect(author.isVerified)
    }
}
