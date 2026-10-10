import Foundation

protocol ViralityClient: Sendable {
    func syncHistory(username: String, timezone: String, niche: String?) async throws -> PostHistory
    func fetchHistory(username: String) async throws -> PostHistory
    func rewrite(postID: String, username: String) async throws -> [String]
    func fetchLeaderboard(filter: LeaderboardFilter, niche: String?, username: String?) async throws -> Leaderboard
    func fetchLeaderboardBreakdown(username: String, period: LeaderboardFilter) async throws -> LeaderboardBreakdown
    func setParticipation(username: String, installID: UUID, optedIn: Bool, niche: String?, timezone: String) async throws
    func fetchChallenges(username: String, installID: UUID) async throws -> [PostingChallenge]
    func createChallenge(challenger: String, opponent: String, duration: PostingChallenge.Duration, installID: UUID) async throws -> PostingChallenge
    func respondToChallenge(id: String, username: String, installID: UUID, accept: Bool) async throws -> PostingChallenge
    /// The install's visible challenges, re-sent by the server whenever one changes. Ends when the connection drops.
    func challengeUpdates(username: String, installID: UUID) -> AsyncThrowingStream<[PostingChallenge], Error>
}

/// Reads a server-sent event stream line by line. `URLSession.AsyncBytes.lines`
/// drops the blank line that ends each event, so an event is emitted on its
/// `data:` line; the POSTLOCK server always sends single-line JSON data.
struct ServerSentEventParser {
    struct Event: Equatable {
        let name: String
        let data: String
    }

    private var name = "message"

    mutating func consume(_ line: String) -> Event? {
        if line.hasPrefix("event:") {
            name = Self.value(of: line, after: "event:")
            return nil
        }
        guard line.hasPrefix("data:") else { return nil }
        defer { name = "message" }
        return Event(name: name, data: Self.value(of: line, after: "data:"))
    }

    private static func value(of line: String, after field: String) -> String {
        let value = line.dropFirst(field.count)
        return String(value.first == " " ? value.dropFirst() : value)
    }
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

    func fetchSuggestions(username: String, niche: String) async throws -> PostSuggestions {
        try await send("POST", "api/v1/postlock/suggestions", body: ["username": username, "niche": niche])
    }

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
            "period": filter.rawValue, "niche": niche, "username": username,
        ])
    }

    func fetchLeaderboardBreakdown(username: String, period: LeaderboardFilter) async throws -> LeaderboardBreakdown {
        try await send("GET", "api/v1/postlock/leaderboard/breakdown", query: [
            "username": username, "period": period.rawValue,
        ])
    }

    func setParticipation(username: String, installID: UUID, optedIn: Bool, niche: String?, timezone: String) async throws {
        let _: ParticipationResponse = try await send("PUT", "api/v1/postlock/leaderboard/participation", body: ParticipationBody(
            username: username, installId: installID.uuidString.lowercased(),
            optedIn: optedIn, niche: niche, timezone: timezone
        ))
    }

    func fetchChallenges(username: String, installID: UUID) async throws -> [PostingChallenge] {
        try await send("GET", "api/v1/postlock/challenges", query: [
            "username": username, "installId": installID.uuidString.lowercased(),
        ])
    }

    func createChallenge(challenger: String, opponent: String, duration: PostingChallenge.Duration, installID: UUID) async throws -> PostingChallenge {
        try await send("POST", "api/v1/postlock/challenges", body: ChallengeBody(
            challengerUsername: challenger,
            challengerInstallId: installID.uuidString.lowercased(),
            opponentUsername: opponent,
            duration: duration.rawValue
        ))
    }

    func respondToChallenge(id: String, username: String, installID: UUID, accept: Bool) async throws -> PostingChallenge {
        try await send("PUT", "api/v1/postlock/challenges/\(id)/respond", body: ChallengeResponseBody(
            username: username,
            installId: installID.uuidString.lowercased(),
            action: accept ? "accept" : "decline"
        ))
    }

    func challengeUpdates(username: String, installID: UUID) -> AsyncThrowingStream<[PostingChallenge], Error> {
        var components = URLComponents(url: baseURL.appending(path: "api/v1/postlock/challenges/stream"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "username", value: username),
            URLQueryItem(name: "installId", value: installID.uuidString.lowercased()),
        ]
        var request = URLRequest(url: components.url!)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        // Idle timeout between bytes; the server pings every 25 seconds.
        request.timeoutInterval = 60
        let session = session, streamRequest = request

        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let (bytes, response) = try await session.bytes(for: streamRequest)
                    guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                        throw ViralityClientError.unavailable
                    }
                    var parser = ServerSentEventParser()
                    for try await line in bytes.lines {
                        guard let event = parser.consume(line), event.name == "challenges" else { continue }
                        continuation.yield(try Self.decoder.decode([PostingChallenge].self, from: Data(event.data.utf8)))
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
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
        request.timeoutInterval = 75
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
    private struct ChallengeBody: Encodable {
        let challengerUsername: String
        let challengerInstallId: String
        let opponentUsername: String
        let duration: String
    }
    private struct ChallengeResponseBody: Encodable {
        let username: String
        let installId: String
        let action: String
    }
    private struct ErrorPayload: Decodable {
        struct Detail: Decodable { let message: String }
        let error: Detail
    }
}
