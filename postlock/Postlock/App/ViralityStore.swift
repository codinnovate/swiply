import Foundation
import Observation

/// State for the History and Leaderboard tabs.
@MainActor
@Observable
final class ViralityStore {
    private(set) var history: PostHistory?
    private(set) var isSyncing = false
    private(set) var historyError: String?

    private(set) var leaderboard: Leaderboard?
    private(set) var isLoadingLeaderboard = false
    private(set) var leaderboardError: String?

    private(set) var isOptedIn: Bool
    private(set) var niche: String
    private(set) var isUpdatingParticipation = false
    private(set) var participationError: String?

    private let client: any ViralityClient
    private let preferences: any LeaderboardPreferencesStoring

    init(client: any ViralityClient, preferences: any LeaderboardPreferencesStoring) {
        self.client = client
        self.preferences = preferences
        isOptedIn = preferences.isOptedIn
        niche = preferences.niche
    }

    private var nicheOrNil: String? {
        let trimmed = niche.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    // MARK: History

    /// Pulls new posts, then polls while the server scores them in the background.
    func refreshHistory(username: String, timezone: String) async {
        guard !isSyncing else { return }
        if history?.username != username { history = nil }
        isSyncing = true
        historyError = nil
        defer { isSyncing = false }
        do {
            history = try await client.syncHistory(username: username, timezone: timezone, niche: nicheOrNil)
            var polls = 0
            while history?.isScoring == true, polls < 40 {
                try await Task.sleep(for: .seconds(3))
                history = try await client.fetchHistory(username: username)
                polls += 1
            }
        } catch is CancellationError {
            return
        } catch {
            // Keep showing the last good history; surface the failure above it.
            historyError = (error as? LocalizedError)?.errorDescription ?? "We couldn't load your posts."
        }
    }

    func rewrite(_ post: ScoredPost, username: String) async throws -> [String] {
        try await client.rewrite(postID: post.postId, username: username)
    }

    // MARK: Leaderboard

    func loadLeaderboard(filter: LeaderboardFilter, niche: String?, username: String?) async {
        isLoadingLeaderboard = true
        leaderboardError = nil
        defer { isLoadingLeaderboard = false }
        do {
            leaderboard = try await client.fetchLeaderboard(filter: filter, niche: niche, username: username)
        } catch is CancellationError {
            return
        } catch {
            leaderboardError = (error as? LocalizedError)?.errorDescription ?? "We couldn't load the leaderboard."
        }
    }

    func setOptedIn(_ optedIn: Bool, username: String, timezone: String) async {
        guard !isUpdatingParticipation else { return }
        isUpdatingParticipation = true
        participationError = nil
        defer { isUpdatingParticipation = false }
        do {
            try await client.setParticipation(
                username: username, installID: preferences.installID,
                optedIn: optedIn, niche: nicheOrNil, timezone: timezone
            )
            isOptedIn = optedIn
            preferences.isOptedIn = optedIn
        } catch {
            participationError = (error as? LocalizedError)?.errorDescription
                ?? "We couldn't update your leaderboard setting."
        }
    }

    /// Saves the niche used for scoring context and leaderboard filtering.
    func setNiche(_ value: String, username: String, timezone: String) async {
        niche = value
        preferences.niche = value
        if isOptedIn { await setOptedIn(true, username: username, timezone: timezone) }
    }

    static func makeLive() -> ViralityStore {
        ViralityStore(
            client: URLSessionViralityClient(baseURL: AppConfiguration.apiBaseURL),
            preferences: DefaultLeaderboardPreferencesStore()
        )
    }
}
