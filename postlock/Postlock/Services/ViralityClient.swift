import Foundation

protocol ViralityClient: Sendable {
    func syncHistory(username: String, timezone: String, niche: String?) async throws -> PostHistory
    func fetchHistory(username: String) async throws -> PostHistory
    func rewrite(postID: String, username: String) async throws -> [String]
    func fetchLeaderboard(filter: LeaderboardFilter, niche: String?, username: String?) async throws -> Leaderboard
    func setParticipation(username: String, installID: UUID, optedIn: Bool, niche: String?, timezone: String) async throws
}

enum ViralityClientError: LocalizedError {
    case server(message: String)
    case unavailable

    var errorDescription: String? {
        switch self {
        case let .server(message): message
        case .unavailable: "We couldn't reach POSTLOCK right now. Please try again."
        }
    }
}

struct URLSessionViralityClient: ViralityClient {
    let baseURL: URL
    var session: URLSession = .shared

    func syncHistory(username: String, timezone: String, niche: String?) async throws -> PostHistory {
        try await send("POST", "api/v1/postlock/history/sync", body: [
            "username": username, "timezone": timezone, "niche": niche,
        ])
    }

    func fetchHistory(username: String) async throws -> PostHistory {
        try await send("GET", "api/v1/postlock/history", query: ["username": username])
    }

    func rewrite(postID: String, username: String) async throws -> [String] {
        let path = "api/v1/postlock/posts/\(postID)/rewrite"
        let result: RewriteResult = try await send("POST", path, body: ["username": username])
        return result.variants
    }

    func fetchLeaderboard(filter: LeaderboardFilter, niche: String?, username: String?) async throws -> Leaderboard {
        try await send("GET", "api/v1/postlock/leaderboard", query: [
            "category": filter.rawValue, "niche": niche, "username": username,
        ])
    }

    func setParticipation(username: String, installID: UUID, optedIn: Bool, niche: String?, timezone: String) async throws {
        let _: ParticipationResponse = try await send("PUT", "api/v1/postlock/leaderboard/participation", body: ParticipationBody(
            username: username, installId: installID.uuidString.lowercased(),
            optedIn: optedIn, niche: niche, timezone: timezone
        ))
    }

    private func send<Response: Decodable>(
        _ method: String,
        _ path: String,
        query: [String: String?] = [:],
        body: (some Encodable)? = Optional<[String: String?]>.none
    ) async throws -> Response {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        let items = query.compactMap { key, value in value.map { URLQueryItem(name: key, value: $0) } }
        if !items.isEmpty { components.queryItems = items }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ViralityClientError.unavailable }
        guard (200 ..< 300).contains(http.statusCode) else {
            if let payload = try? JSONDecoder().decode(ErrorPayload.self, from: data) {
                throw ViralityClientError.server(message: payload.error.message)
            }
            throw ViralityClientError.unavailable
        }
        return try Self.decoder.decode(Response.self, from: data)
    }

    /// The API sends ISO 8601 dates with milliseconds.
    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            if let date = try? Date(raw, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) {
                return date
            }
            if let date = try? Date(raw, strategy: .iso8601) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid date \(raw)"))
        }
        return decoder
    }()

    private struct ParticipationBody: Encodable {
        let username: String
        let installId: String
        let optedIn: Bool
        let niche: String?
        let timezone: String
    }

    private struct ParticipationResponse: Decodable { let optedIn: Bool }
    private struct ErrorPayload: Decodable {
        struct Detail: Decodable { let message: String }
        let error: Detail
    }
}
