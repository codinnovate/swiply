import ActivityKit
import SwiftUI
import WidgetKit

private let ink = Color(red: 13 / 255, green: 14 / 255, blue: 20 / 255)
private let violet = Color(red: 187 / 255, green: 174 / 255, blue: 1)
private let mint = Color(red: 143 / 255, green: 224 / 255, blue: 194 / 255)

@main
struct PostlockChallengeWidgetBundle: WidgetBundle {
    var body: some Widget { PostlockChallengeLiveActivity() }
}

struct PostlockChallengeLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PostingChallengeAttributes.self) { context in
            ChallengeLockScreen(context: context)
                .activityBackgroundTint(ink)
                .activitySystemActionForegroundColor(violet)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    compactCompetitor(context.attributes.firstName, username: context.attributes.firstUsername, score: context.state.firstScore, tint: violet)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    compactCompetitor(context.attributes.secondName, username: context.attributes.secondUsername, score: context.state.secondScore, tint: mint)
                }
                DynamicIslandExpandedRegion(.center) {
                    Image(systemName: "bolt.fill").foregroundStyle(.orange)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.attributes.durationLabel).tracking(1.2)
                        Spacer()
                        Text(timerInterval: Date.now...context.state.endsAt, countsDown: true)
                            .monospacedDigit()
                    }.font(.caption2.weight(.bold)).foregroundStyle(.secondary)
                }
            } compactLeading: {
                Text("\(context.state.firstScore)").font(.caption.weight(.bold)).foregroundStyle(violet)
            } compactTrailing: {
                Text("\(context.state.secondScore)").font(.caption.weight(.bold)).foregroundStyle(mint)
            } minimal: {
                Image(systemName: "bolt.fill").foregroundStyle(violet)
            }
            .keylineTint(violet)
        }
    }

    private func compactCompetitor(_ name: String, username: String, score: Int, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                ChallengeAvatar(name: name, username: username, tint: tint, size: 18)
                Text(name).font(.caption2).lineLimit(1)
            }
            Text("\(score)").font(.title2.bold()).monospacedDigit().foregroundStyle(tint)
        }.frame(maxWidth: 78, alignment: .leading)
    }
}

private struct ChallengeLockScreen: View {
    let context: ActivityViewContext<PostingChallengeAttributes>

    private var firstLeading: Bool { context.state.firstScore > context.state.secondScore }
    private var secondLeading: Bool { context.state.secondScore > context.state.firstScore }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Label(context.attributes.durationLabel, systemImage: "bolt.fill")
                    .font(.caption2.bold()).tracking(1.1).foregroundStyle(violet)
                Spacer()
                Text(timerInterval: Date.now...context.state.endsAt, countsDown: true)
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            HStack(spacing: 12) {
                competitor(context.attributes.firstName, username: context.attributes.firstUsername, score: context.state.firstScore, leading: firstLeading, tint: violet, alignment: .leading)
                Text("VS").font(.caption2.weight(.black)).foregroundStyle(ink)
                    .frame(width: 30, height: 30).background(.orange, in: Circle())
                competitor(context.attributes.secondName, username: context.attributes.secondUsername, score: context.state.secondScore, leading: secondLeading, tint: mint, alignment: .trailing)
            }
        }.padding(16)
    }

    /// The second competitor mirrors the first so the VS badge sits in the visual center.
    private func competitor(_ name: String, username: String, score: Int, leading: Bool, tint: Color, alignment: HorizontalAlignment) -> some View {
        let mirrored = alignment == .trailing
        let details = VStack(alignment: alignment, spacing: 1) {
            HStack(spacing: 3) {
                if leading && mirrored { crown(tint) }
                Text(name).font(.caption.weight(.semibold)).lineLimit(1)
                if leading && !mirrored { crown(tint) }
            }
            Text("\(score) posts").font(.title3.bold()).monospacedDigit().foregroundStyle(leading ? tint : .white)
        }
        let avatar = ChallengeAvatar(name: name, username: username, tint: tint, size: 34)
            .overlay { Circle().stroke(leading ? tint : .white.opacity(0.12), lineWidth: leading ? 2 : 1) }
        return HStack(spacing: 9) {
            if mirrored { details; avatar } else { avatar; details }
        }.frame(maxWidth: .infinity, alignment: mirrored ? .trailing : .leading)
    }

    private func crown(_ tint: Color) -> some View {
        Image(systemName: "crown.fill").font(.system(size: 8)).foregroundStyle(tint)
    }
}

private struct ChallengeAvatar: View {
    let name: String
    let username: String
    let tint: Color
    let size: CGFloat

    var body: some View {
        Group {
            if let url = ChallengeAvatarStore.fileURL(for: username), let image = UIImage(contentsOfFile: url.path) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Text(name.prefix(1).uppercased()).font(.caption.bold()).foregroundStyle(tint)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(tint.opacity(0.14))
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}
