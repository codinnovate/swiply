import Foundation

struct PostingProfile: Codable, Equatable, Sendable {
    enum VerificationType: String, Codable, Sendable {
        case individual
        case organization
        case government
    }

    let username: String
    let displayName: String
    let avatarURL: URL?
    let isPublic: Bool
    let isVerified: Bool?
    let verificationType: VerificationType?

    enum CodingKeys: String, CodingKey {
        case username
        case displayName
        case avatarURL = "avatarUrl"
        case isPublic
        case isVerified
        case verificationType
    }
}

struct PostingProfileResponse: Decodable, Sendable {
    let profile: PostingProfile
}
