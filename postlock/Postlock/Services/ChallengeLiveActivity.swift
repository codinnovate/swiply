import ActivityKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

enum ChallengeLiveActivity {
    static func sync(_ challenge: PostingChallenge) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled, challenge.status == .active else { return }
        async let first: Void = cacheAvatar(for: challenge.challenger)
        async let second: Void = cacheAvatar(for: challenge.opponent)
        _ = await (first, second)
        let state = PostingChallengeAttributes.ContentState(
            firstScore: challenge.challenger.score,
            secondScore: challenge.opponent.score,
            endsAt: challenge.endsAt
        )
        if let activity = Activity<PostingChallengeAttributes>.activities.first(where: { $0.attributes.challengeID == challenge.id }) {
            await activity.update(ActivityContent(state: state, staleDate: challenge.endsAt))
            return
        }
        let attributes = PostingChallengeAttributes(
            challengeID: challenge.id,
            firstName: challenge.challenger.displayName,
            firstUsername: challenge.challenger.username,
            secondName: challenge.opponent.displayName,
            secondUsername: challenge.opponent.username,
            durationLabel: challenge.duration == .day ? "DAILY DUEL" : "WEEKLY DUEL"
        )
        _ = try? Activity.request(
            attributes: attributes,
            content: ActivityContent(state: state, staleDate: challenge.endsAt),
            pushType: nil
        )
    }

    static func end(_ challenge: PostingChallenge) async {
        let state = PostingChallengeAttributes.ContentState(
            firstScore: challenge.challenger.score,
            secondScore: challenge.opponent.score,
            endsAt: challenge.endsAt
        )
        for activity in Activity<PostingChallengeAttributes>.activities where activity.attributes.challengeID == challenge.id {
            await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .default)
        }
    }

    /// Downscales and writes the avatar into the app group so the widget extension can render it offline.
    private static func cacheAvatar(for person: ChallengePerson) async {
        guard let remote = person.avatarUrl, let destination = ChallengeAvatarStore.fileURL(for: person.username) else { return }
        guard let (data, _) = try? await URLSession.shared.data(from: remote),
              let source = CGImageSourceCreateWithData(data as CFData, nil),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceCreateThumbnailWithTransform: true,
                  kCGImageSourceThumbnailMaxPixelSize: 144,
              ] as CFDictionary)
        else { return }
        try? FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard let output = CGImageDestinationCreateWithURL(destination as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
        CGImageDestinationAddImage(output, thumbnail, nil)
        CGImageDestinationFinalize(output)
    }
}
