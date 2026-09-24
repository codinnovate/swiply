import Foundation

struct PostVerificationResult: Decodable, Sendable {
    let verified: Bool
    let verifiedCount: Int
    let goal: Int
    let shouldBlock: Bool
}

protocol PostVerificationClient: Sendable {
    func verify(username: String, commitment: PostingCommitment) async throws -> PostVerificationResult
}

struct URLSessionPostVerificationClient: PostVerificationClient {
    let baseURL: URL
    var session: URLSession = .shared

    func verify(username: String, commitment: PostingCommitment) async throws -> PostVerificationResult {
        let url = baseURL.appending(path: "api/v1/posting-commitment/verify")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(RequestBody(
            username: username,
            timezone: commitment.timezoneIdentifier,
            postingDays: commitment.postingDays.sorted(),
            deadlineMinutes: commitment.deadlineMinutes.sorted(),
            qualifyingPostTypes: commitment.qualifyingPostTypes
        ))
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw VerificationError.providerUnavailable
        }
        return try JSONDecoder().decode(PostVerificationResult.self, from: data)
    }

    private struct RequestBody: Encodable {
        let username: String
        let timezone: String
        let postingDays: [Int]
        let deadlineMinutes: [Int]
        let qualifyingPostTypes: PostingCommitment.QualifyingPostTypes
    }
}

enum VerificationError: LocalizedError {
    case providerUnavailable

    var errorDescription: String? {
        "We couldn't check your public posts right now. Please try again."
    }
}
