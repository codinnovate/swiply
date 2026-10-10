import Foundation
import Testing
@testable import Postlock

struct ServerSentEventParserTests {
    private func events(from lines: [String]) -> [ServerSentEventParser.Event] {
        var parser = ServerSentEventParser()
        return lines.compactMap { parser.consume($0) }
    }

    @Test func readsNamedEventsAsTheServerSendsThem() {
        // What NestJS writes, minus the blank lines URLSession's `lines` drops.
        let parsed = events(from: ["event: challenges", "id: 1", "data: []", "event: ping", "id: 2", "data: "])

        #expect(parsed == [
            .init(name: "challenges", data: "[]"),
            .init(name: "ping", data: ""),
        ])
    }

    @Test func treatsUnnamedDataAsAMessageEvent() {
        #expect(events(from: ["data: hello"]) == [.init(name: "message", data: "hello")])
    }

    @Test func doesNotCarryAnEventNameIntoTheNextEvent() {
        let parsed = events(from: ["event: challenges", "data: []", "data: later"])

        #expect(parsed.last == .init(name: "message", data: "later"))
    }

    @Test func keepsColonsAndSpacesInsideTheData() {
        let json = #"[{"id":"a","note":"  spaced: yes"}]"#

        #expect(events(from: ["event: challenges", "data: \(json)"]).first?.data == json)
    }

    @Test func ignoresCommentsAndOtherFields() {
        #expect(events(from: [": keep-alive", "id: 7", "retry: 1000"]).isEmpty)
    }

    @Test func decodesAStreamedChallengeList() throws {
        let data = """
        [{"id":"c1","challenger":{"username":"alice","displayName":"Alice","avatarUrl":null,"score":2},\
        "opponent":{"username":"bob","displayName":"Bob","avatarUrl":null,"score":1},"duration":"day",\
        "status":"active","startsAt":"2026-09-25T08:00:00.000Z","endsAt":"2026-09-26T08:00:00.000Z",\
        "requiresResponse":false}]
        """
        let event = try #require(events(from: ["event: challenges", "data: \(data)"]).first)

        let challenges = try URLSessionViralityClient.decoder.decode([PostingChallenge].self, from: Data(event.data.utf8))

        #expect(challenges.map(\.id) == ["c1"])
        #expect(challenges.first?.challenger.score == 2)
    }
}
