import Foundation
import Observation

@MainActor
@Observable
final class UsernameSetupViewModel {
    enum State: Equatable {
        case entry
        case loading
        case confirmation(PostingProfile)
        case protectedAccount
    }

    var rawUsername = ""
    var state: State = .entry
    var errorMessage: String?

    private let client: any PostingProfileClient

    init(client: any PostingProfileClient) {
        self.client = client
    }

    var isLoading: Bool { state == .loading }
    var canSubmit: Bool { !rawUsername.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading }

    func verify() async {
        errorMessage = nil
        do {
            let username = try UsernameNormalizer.normalize(rawUsername)
            rawUsername = username
            state = .loading
            let profile = try await client.lookup(username: username)
            state = profile.isPublic ? .confirmation(profile) : .protectedAccount
        } catch PostingProfileClientError.protectedAccount {
            state = .protectedAccount
        } catch is CancellationError {
            state = .entry
        } catch {
            state = .entry
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Something went wrong. Try again."
        }
    }

    func changeUsername() {
        state = .entry
        errorMessage = nil
    }
}
