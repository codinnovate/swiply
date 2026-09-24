import Foundation

protocol PostingProfileClient: Sendable {
    func lookup(username: String) async throws -> PostingProfile
}

enum PostingProfileClientError: LocalizedError, Equatable {
    case profileNotFound
    case protectedAccount
    case invalidResponse
    case server(message: String)

    var errorDescription: String? {
        switch self {
        case .profileNotFound:
            "We couldn't find that X username. Check it and try again."
        case .protectedAccount:
            "POSTLOCK currently works with public X accounts."
        case .invalidResponse:
            "We couldn't verify that username right now. Try again shortly."
        case let .server(message):
            message
        }
    }
}

struct URLSessionPostingProfileClient: PostingProfileClient {
    let baseURL: URL

    func lookup(username: String) async throws -> PostingProfile {
        let endpoint = baseURL.appending(path: "api/v1/posting-profile")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(RequestBody(username: username))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PostingProfileClientError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200 ..< 300:
            let profile = try JSONDecoder().decode(PostingProfileResponse.self, from: data).profile
            guard profile.isPublic else { throw PostingProfileClientError.protectedAccount }
            return profile
        case 403:
            throw PostingProfileClientError.protectedAccount
        case 404:
            throw PostingProfileClientError.profileNotFound
        default:
            if let payload = try? JSONDecoder().decode(ErrorPayload.self, from: data), !payload.message.isEmpty {
                throw PostingProfileClientError.server(message: payload.message)
            }
            throw PostingProfileClientError.invalidResponse
        }
    }

    private struct RequestBody: Encodable { let username: String }
    private struct ErrorPayload: Decodable { let message: String }
}
