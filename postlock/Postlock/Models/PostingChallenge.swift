import ActivityKit
import Foundation

struct ChallengePerson: Codable, Equatable, Sendable {
    let username: String
    let displayName: String
    let avatarUrl: URL?
    let score: Int
}

struct PostingChallenge: Codable, Equatable, Identifiable, Sendable {
    enum Duration: String, Codable, CaseIterable, Identifiable, Sendable {
        case day, week
        var id: String { rawValue }
        var title: String { self == .day ? "24 hours" : "7 days" }
    }

    enum Status: String, Codable, Sendable { case pending, active, declined, completed }

    let id: String
    let challenger: ChallengePerson
    let opponent: ChallengePerson
    let duration: Duration
    let status: Status
    let startsAt: Date
    let endsAt: Date
    let requiresResponse: Bool

    func person(for username: String) -> ChallengePerson {
        challenger.username == username ? challenger : opponent
    }

    func rival(for username: String) -> ChallengePerson {
        challenger.username == username ? opponent : challenger
    }
}

struct PostingChallengeAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let firstScore: Int
        let secondScore: Int
        let endsAt: Date
    }

    let challengeID: String
    let firstName: String
    let firstUsername: String
    let secondName: String
    let secondUsername: String
    let durationLabel: String
}

/// Live Activities can't fetch remote images, so the app caches avatars in the shared container for the widget to read.
enum ChallengeAvatarStore {
    private static let appGroup = "group.com.swiply.postlock"

    static func fileURL(for username: String) -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent("ChallengeAvatars", isDirectory: true)
            .appendingPathComponent("\(username.lowercased()).png")
    }
}
