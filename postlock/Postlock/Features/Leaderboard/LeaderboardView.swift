import SwiftUI

struct LeaderboardView: View {
    @Environment(AppSession.self) private var session
    @Environment(ViralityStore.self) private var store
    @State private var filter: LeaderboardFilter = .all
    @State private var niche: String?

    private var username: String { session.profile?.username ?? "" }
    private var timezone: String { session.commitment?.timezoneIdentifier ?? TimeZone.current.identifier }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Show", selection: $filter) {
                        ForEach(LeaderboardFilter.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                if !store.isOptedIn { optInSection }

                if let leaderboard = store.leaderboard {
                    rankingSection(leaderboard)
                } else if let error = store.leaderboardError {
                    ContentUnavailableView("Leaderboard unavailable", systemImage: "wifi.exclamationmark", description: Text(error))
                        .listRowBackground(Color.clear)
                } else {
                    ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Leaderboard")
            .toolbar {
                if let niches = store.leaderboard?.niches, !niches.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) { nicheMenu(niches) }
                }
            }
            .refreshable { await load() }
            .task(id: "\(filter.rawValue)|\(niche ?? "")|\(store.isOptedIn)") { await load() }
        }
    }

    private func load() async {
        await store.loadLeaderboard(filter: filter, niche: niche, username: username)
    }

    private func nicheMenu(_ niches: [String]) -> some View {
        Menu {
            Picker("Niche", selection: $niche) {
                Text("All niches").tag(String?.none)
                ForEach(niches, id: \.self) { Text($0).tag(Optional($0)) }
            }
        } label: {
            Label(niche ?? "Niche", systemImage: niche == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
        }
        .accessibilityLabel(niche.map { "Niche filter: \($0)" } ?? "Filter by niche")
    }

    private var optInSection: some View {
        Section {
            VStack(alignment: .leading, spacing: Spacing.medium) {
                Label("Want to see where you rank?", systemImage: "trophy")
                    .font(.headline)
                Text("Join to be ranked alongside other PostLock users by your average virality score. Your handle is only shown if you opt in, and you can leave any time in Settings.")
                    .font(.footnote).foregroundStyle(Theme.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
                if let error = store.participationError {
                    Text(error).font(.footnote).foregroundStyle(Theme.danger)
                }
                PrimaryButton(title: "Show me on the leaderboard", isLoading: store.isUpdatingParticipation) {
                    Task { await store.setOptedIn(true, username: username, timezone: timezone) }
                }
            }
            .padding(.vertical, Spacing.small)
        }
    }

    @ViewBuilder
    private func rankingSection(_ leaderboard: Leaderboard) -> some View {
        if let me = leaderboard.me {
            Section("You") { LeaderboardRow(entry: me, isMe: true) }
        } else if store.isOptedIn {
            Section("You") {
                Text("You'll appear after \(leaderboard.window.minimumPosts) scored posts in the last \(leaderboard.window.days) days. Rankings refresh every few hours.")
                    .font(.footnote).foregroundStyle(Theme.secondaryText)
            }
        }

        Section {
            if leaderboard.entries.isEmpty {
                Text("No one is ranked here yet.")
                    .font(.subheadline).foregroundStyle(Theme.secondaryText)
            }
            ForEach(leaderboard.entries) { entry in
                LeaderboardRow(entry: entry, isMe: entry.username == username)
            }
        } header: {
            Text("Top accounts")
        } footer: {
            Text("Ranked by average virality score across each account's last \(leaderboard.window.posts) posts from the past \(leaderboard.window.days) days. Updated \(leaderboard.computedAt.formatted(.relative(presentation: .named))).")
        }
    }
}

private struct LeaderboardRow: View {
    let entry: LeaderboardEntry
    var isMe = false

    var body: some View {
        HStack(spacing: Spacing.medium) {
            Text("\(entry.rank)")
                .font(.system(.headline, design: .rounded).monospacedDigit())
                .foregroundStyle(entry.rank <= 3 ? Theme.accent : Theme.secondaryText)
                .frame(minWidth: 28)
            AvatarView(url: entry.avatarUrl, displayName: entry.displayName, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(entry.displayName).font(.subheadline.weight(.semibold)).lineLimit(1)
                    if entry.category == .featured {
                        Text("FEATURED")
                            .font(.caption2.weight(.bold)).tracking(0.6)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Theme.accent.opacity(0.15), in: Capsule())
                            .foregroundStyle(Theme.accent)
                    }
                    if isMe {
                        Text("YOU").font(.caption2.weight(.bold)).foregroundStyle(Theme.secondaryText)
                    }
                }
                Text("@\(entry.username)").font(.caption).foregroundStyle(Theme.secondaryText)
                Label("\(entry.avgReplies.formatted(.number.precision(.fractionLength(0 ... 1)))) replies/post", systemImage: "bubble.left")
                    .font(.caption2).foregroundStyle(Theme.secondaryText)
            }
            Spacer(minLength: 0)
            ScoreBadge(score: entry.avgScore, size: 44, lineWidth: 4)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .listRowBackground(isMe ? Theme.accent.opacity(0.08) : Theme.surface)
    }
}
