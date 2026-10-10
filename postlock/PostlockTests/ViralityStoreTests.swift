import Foundation
import Testing
@testable import Postlock

@MainActor
struct ViralityStoreTests {
    // MARK: History errors

    @Test func cancelledHistoryRequestIsNotShownAsAnError() async {
        let client = StubViralityClient(historyError: URLError(.cancelled))
        let store = makeStore(client)

        await store.refreshHistory(username: "sam", timezone: "UTC")

        #expect(store.historyError == nil)
    }

    @Test func failedHistoryRequestShowsTheFallbackMessage() async {
        let client = StubViralityClient(historyError: URLError(.timedOut))
        let store = makeStore(client)

        await store.refreshHistory(username: "sam", timezone: "UTC")

        #expect(store.historyError == "We couldn't load your posts.")
    }

    @Test func serverHistoryErrorShowsTheServerMessage() async {
        let client = StubViralityClient(historyError: ViralityClientError.server(message: "X is down."))
        let store = makeStore(client)

        await store.refreshHistory(username: "sam", timezone: "UTC")

        #expect(store.historyError == "X is down.")
    }

    // MARK: Challenge stream

    @Test func appliesEveryPushFromTheChallengeStream() async throws {
        let client = StubViralityClient(streams: [[[duel("a", score: 0)], [duel("a", score: 1)]]])
        let store = makeStore(client)

        let watching = Task { await store.watchChallenges(username: "alice") }
        try await waitUntil { store.challenges.first?.challenger.score == 1 }
        watching.cancel()
        await watching.value

        #expect(store.challenges.map(\.id) == ["a"])
    }

    @Test func reconnectsWhenTheStreamDrops() async throws {
        let client = StubViralityClient(streams: [[[duel("a")]], [[duel("b")]]])
        let store = makeStore(client)

        let watching = Task { await store.watchChallenges(username: "alice") }
        try await waitUntil { store.challenges.map(\.id) == ["b"] }
        watching.cancel()
        await watching.value

        #expect(client.connections >= 2)
    }

    @Test func stopsWatchingWhenCancelled() async throws {
        let client = StubViralityClient(streams: [[[duel("a")]]])
        let store = makeStore(client)

        let watching = Task { await store.watchChallenges(username: "alice") }
        try await waitUntil { !store.challenges.isEmpty }
        watching.cancel()
        await watching.value
        let connections = client.connections
        try await Task.sleep(for: .milliseconds(50))

        #expect(client.connections == connections)
    }

    @Test func doesNotConnectWithoutAUsername() async {
        let client = StubViralityClient(streams: [[[duel("a")]]])
        let store = makeStore(client)

        await store.watchChallenges(username: "")

        #expect(client.connections == 0)
        #expect(store.challenges.isEmpty)
    }

    // MARK: Helpers

    private func makeStore(_ client: StubViralityClient) -> ViralityStore {
        let store = ViralityStore(client: client, preferences: StubPreferences())
        store.reconnectDelay = .milliseconds(5)
        return store
    }

    /// Pending duels keep the store from starting real Live Activities.
    private func duel(_ id: String, score: Int = 0) -> PostingChallenge {
        PostingChallenge(
            id: id,
            challenger: ChallengePerson(username: "alice", displayName: "Alice", avatarUrl: nil, score: score),
            opponent: ChallengePerson(username: "bob", displayName: "Bob", avatarUrl: nil, score: 0),
            duration: .day,
            status: .pending,
            startsAt: Date(timeIntervalSince1970: 0),
            endsAt: Date(timeIntervalSince1970: 86_400),
            requiresResponse: false
        )
    }

    private func waitUntil(_ condition: () -> Bool) async throws {
        for _ in 0 ..< 200 where !condition() {
            try await Task.sleep(for: .milliseconds(10))
        }
        try #require(condition())
    }
}

private struct StubPreferences: LeaderboardPreferencesStoring {
    let installID = UUID(uuidString: "11111111-1111-4111-8111-111111111111")!
    var isOptedIn: Bool { get { false } nonmutating set {} }
    var niche: String { get { "" } nonmutating set {} }
}

/// Each `challengeUpdates` call plays the next scripted stream (its pushes, then a
/// dropped connection). With the script used up, the stream stays open until cancelled.
private final class StubViralityClient: ViralityClient, @unchecked Sendable {
    private let lock = NSLock()
    private var streams: [[[PostingChallenge]]]
    private var connectionCount = 0
    private let historyError: (any Error)?

    init(streams: [[[PostingChallenge]]] = [], historyError: (any Error)? = nil) {
        self.streams = streams
        self.historyError = historyError
    }

    var connections: Int { lock.withLock { connectionCount } }

    func challengeUpdates(username: String, installID: UUID) -> AsyncThrowingStream<[PostingChallenge], Error> {
        let script: [[PostingChallenge]]? = lock.withLock {
            connectionCount += 1
            return streams.isEmpty ? nil : streams.removeFirst()
        }
        return AsyncThrowingStream { continuation in
            guard let script else { return }
            for update in script { continuation.yield(update) }
            continuation.finish()
        }
    }

    func syncHistory(username: String, timezone: String, niche: String?) async throws -> PostHistory {
        throw historyError ?? ViralityClientError.unavailable
    }

    func fetchHistory(username: String) async throws -> PostHistory { throw ViralityClientError.unavailable }
    func rewrite(postID: String, username: String) async throws -> [String] { [] }
    func fetchLeaderboard(filter: LeaderboardFilter, niche: String?, username: String?) async throws -> Leaderboard {
        throw ViralityClientError.unavailable
    }
    func fetchLeaderboardBreakdown(username: String, period: LeaderboardFilter) async throws -> LeaderboardBreakdown {
        throw ViralityClientError.unavailable
    }
    func setParticipation(username: String, installID: UUID, optedIn: Bool, niche: String?, timezone: String) async throws {}
    func fetchChallenges(username: String, installID: UUID) async throws -> [PostingChallenge] { [] }
    func createChallenge(challenger: String, opponent: String, duration: PostingChallenge.Duration, installID: UUID) async throws -> PostingChallenge {
        throw ViralityClientError.unavailable
    }
    func respondToChallenge(id: String, username: String, installID: UUID, accept: Bool) async throws -> PostingChallenge {
        throw ViralityClientError.unavailable
    }
}
