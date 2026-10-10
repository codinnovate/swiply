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
    private(set) var challenges: [PostingChallenge] = []
    private(set) var isLoadingChallenges = false
    private(set) var challengeError: String?
    private(set) var isUpdatingChallenge = false

    private let client: any ViralityClient
    private let preferences: any LeaderboardPreferencesStoring
    /// First wait before reconnecting a dropped challenge stream; doubles up to 30 seconds.
    var reconnectDelay: Duration = .seconds(2)

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

    var installID: UUID { preferences.installID }

    var activeChallenges: [PostingChallenge] { challenges.filter { $0.status == .active } }
    var challengeInvitations: [PostingChallenge] { challenges.filter { $0.status == .pending && $0.requiresResponse } }
    var outgoingChallenges: [PostingChallenge] { challenges.filter { $0.status == .pending && !$0.requiresResponse } }
    var completedChallenges: [PostingChallenge] { challenges.filter { $0.status == .completed } }

    func loadChallenges(username: String) async {
        guard !username.isEmpty else { return }
        isLoadingChallenges = true
        challengeError = nil
        defer { isLoadingChallenges = false }
        do {
            await apply(try await client.fetchChallenges(username: username, installID: installID))
        } catch is CancellationError {
            return
        } catch let error as URLError where error.code == .cancelled {
            return
        } catch {
            challengeError = (error as? LocalizedError)?.errorDescription ?? "We couldn't load your challenges."
        }
    }

    /// Keeps challenges live while the app is open: applies every server push and
    /// reconnects with backoff when the stream drops. Returns when the task is cancelled.
    func watchChallenges(username: String) async {
        guard !username.isEmpty else { return }
        var delay = reconnectDelay
        while !Task.isCancelled {
            do {
                for try await update in client.challengeUpdates(username: username, installID: installID) {
                    await apply(update)
                    delay = reconnectDelay
                }
            } catch {
                // Dropped connections, server restarts, and offline periods all just retry.
            }
            try? await Task.sleep(for: delay)
            delay = min(delay * 2, .seconds(30))
        }
    }

    private func apply(_ updated: [PostingChallenge]) async {
        challenges = updated
        for challenge in updated {
            if challenge.status == .active { await ChallengeLiveActivity.sync(challenge) }
            if challenge.status == .completed { await ChallengeLiveActivity.end(challenge) }
        }
    }

    func createChallenge(challenger: String, opponent: String, duration: PostingChallenge.Duration) async -> Bool {
        guard !isUpdatingChallenge else { return false }
        isUpdatingChallenge = true
        challengeError = nil
        defer { isUpdatingChallenge = false }
        do {
            let challenge = try await client.createChallenge(challenger: challenger, opponent: opponent, duration: duration, installID: installID)
            challenges.removeAll { $0.id == challenge.id }
            challenges.insert(challenge, at: 0)
            if challenge.status == .active { await ChallengeLiveActivity.sync(challenge) }
            return true
        } catch {
            challengeError = (error as? LocalizedError)?.errorDescription ?? "We couldn't start that challenge."
            return false
        }
    }

    func respond(to challenge: PostingChallenge, username: String, accept: Bool) async {
        guard !isUpdatingChallenge else { return }
        isUpdatingChallenge = true
        challengeError = nil
        defer { isUpdatingChallenge = false }
        do {
            let updated = try await client.respondToChallenge(id: challenge.id, username: username, installID: installID, accept: accept)
            challenges = challenges.map { $0.id == updated.id ? updated : $0 }
            if updated.status == .active { await ChallengeLiveActivity.sync(updated) }
        } catch {
            challengeError = (error as? LocalizedError)?.errorDescription ?? "We couldn't update that invitation."
        }
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
        } catch let error as URLError where error.code == .cancelled {
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

    /// Fetched per sheet rather than cached: it's only read while the sheet is open.
    func leaderboardBreakdown(username: String, period: LeaderboardFilter) async throws -> LeaderboardBreakdown {
        try await client.fetchLeaderboardBreakdown(username: username, period: period)
    }

    func loadLeaderboard(filter: LeaderboardFilter, niche: String?, username: String?) async {
        isLoadingLeaderboard = true
        leaderboardError = nil
        defer { isLoadingLeaderboard = false }
        do {
            leaderboard = try await client.fetchLeaderboard(filter: filter, niche: niche, username: username)
        } catch is CancellationError {
            return
        } catch let error as URLError where error.code == .cancelled {
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
