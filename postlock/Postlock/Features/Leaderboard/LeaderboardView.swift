import SwiftUI

struct LeaderboardView: View {
    @Environment(AppSession.self) private var session
    @Environment(ViralityStore.self) private var store
    @State private var filter: LeaderboardFilter = .all
    @State private var niche: String?
    @State private var showingInfo = false
    @State private var showingChallenges = false
    @State private var inspecting: LeaderboardEntry?

    private var username: String { session.profile?.username ?? "" }
    private var timezone: String { session.commitment?.timezoneIdentifier ?? TimeZone.current.identifier }
    private var board: Leaderboard? { store.leaderboard }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    filters
                    if let board {
                        ranking(board)
                    } else if store.isLoadingLeaderboard {
                        ProgressView().tint(Theme.accent).frame(maxWidth: .infinity).padding(50)
                    } else {
                        VStack(spacing: 12) {
                            Image(systemName: "wifi.exclamationmark").font(.title2).foregroundStyle(Theme.secondaryText)
                            Text("Couldn't load rankings").font(.headline)
                            Button("Try again") { Task { await load() } }.frame(minHeight: 44)
                        }.frame(maxWidth: .infinity).padding(.vertical, 40)
                    }
                    if !store.isOptedIn { optIn }
                }.padding(.horizontal, 20).padding(.bottom, 28)
            }
            .background(Theme.background)
            .toolbar(.hidden, for: .navigationBar)
            .refreshable { await load() }
            .task(id: "\(filter.rawValue)|\(niche ?? "")|\(store.isOptedIn)") { await load() }
            .task(id: username) { await store.loadChallenges(username: username) }
            .sheet(isPresented: $showingInfo) {
                NavigationStack {
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 18) {
                            Text("How rankings work").font(.title2.weight(.semibold))
                            Text("Ranked by XP: the engagement your posts earn, weighted the way X's ranking weighs it. Replies beat likes, and replying back to people who reply to you earns the most.")
                            if let rules = board?.xpRules { Text(rules.note) }
                            if let board {
                                Text("Post at least \(board.window.minimumPosts) times in \(board.window.days) days to qualify.")
                                Text("Updated \(board.computedAt.formatted(.relative(presentation: .named))).")
                            }
                            Text("Featured accounts are prolific X posters, curated by us. Start better conversations than them and you'll rank above them. You appear publicly only when you join, and can leave in Settings.")
                        }.font(.subheadline).foregroundStyle(Theme.secondaryText).padding(24)
                    }.background(Theme.background)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showingInfo = false } } }
                }.presentationDetents([.medium, .large]).presentationDragIndicator(.visible).tint(Theme.accent)
            }
            .sheet(item: $inspecting) { entry in
                LeaderboardBreakdownSheet(entry: entry, period: filter)
                    .presentationDetents([.large]).presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showingChallenges) {
                ChallengeHubView(username: username, leaderboard: board?.entries ?? [])
            }
        }
    }

    private var header: some View {
        DashboardHeading(title: "Leaderboard") {
            HStack(spacing: 4) {
                Button { showingChallenges = true } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bolt.horizontal.circle.fill").font(.system(size: 20, weight: .semibold))
                            .frame(width: 36, height: 36).background(Theme.accent.opacity(0.12), in: Circle())
                        if !store.challengeInvitations.isEmpty {
                            Circle().fill(Theme.danger).frame(width: 9, height: 9)
                                .overlay { Circle().stroke(Theme.background, lineWidth: 2) }
                        }
                    }.frame(width: 44, height: 44)
                }.foregroundStyle(Theme.accent).accessibilityLabel("Open challenges")
                Button { showingInfo = true } label: {
                    Image(systemName: "info").font(.system(size: 14, weight: .medium))
                        .frame(width: 36, height: 36).background(Theme.surface, in: Circle())
                        .overlay { Circle().stroke(.white.opacity(0.07), lineWidth: 1) }
                        .frame(width: 44, height: 44)
                }.foregroundStyle(Theme.secondaryText).accessibilityLabel("How rankings work")
            }
        }
    }

    @Namespace private var filterNamespace

    private var filters: some View {
        HStack(spacing: 0) {
            ForEach(LeaderboardFilter.allCases) { option in
                filterLabel(option)
                    .background {
                        if filter == option {
                            Capsule().fill(Theme.accent)
                                .matchedGeometryEffect(id: "indicator", in: filterNamespace)
                        }
                    }
            }
        }
        .padding(4)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay { Capsule().stroke(.white.opacity(0.08), lineWidth: 1) }
    }

    private func filterLabel(_ option: LeaderboardFilter) -> some View {
        Button {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) { filter = option }
        } label: {
            Text(option.title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(filter == option ? .white : Theme.secondaryText)
                .frame(maxWidth: .infinity).frame(height: 40)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(filter == option ? .isSelected : [])
    }

    private func ranking(_ board: Leaderboard) -> some View {
        let entries = board.entries
        let top = Array(entries.prefix(3))
        let remaining = Array(entries.dropFirst(3))
        return VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 8) {
                HStack(spacing: 5) {
                    Circle().fill(Theme.mint).frame(width: 4, height: 4)
                    Text(rankingLabel(board)).tracking(1.4)
                }
                Spacer()
            }.font(.system(size: 9, weight: .semibold)).foregroundStyle(Theme.secondaryText)
            if top.isEmpty {
                ContentUnavailableView("No rankings yet", systemImage: "trophy")
            } else {
                HStack(alignment: .bottom, spacing: 8) {
                    if top.count > 1 { inspectable(top[1]) { podium(top[1], elevated: false) } }
                    inspectable(top[0]) { podium(top[0], elevated: true) }
                    if top.count > 2 { inspectable(top[2]) { podium(top[2], elevated: false) } }
                }
                .padding(.horizontal, 10).padding(.top, 18)
                .background {
                    RoundedRectangle(cornerRadius: 26)
                        .fill(RadialGradient(colors: [Theme.accent.opacity(0.12), Theme.background.opacity(0)], center: .top, startRadius: 0, endRadius: 230))
                }
            }
            if let me = board.me {
                inspectable(me) { LeaderboardRow(entry: me, isMe: true) }
                    .padding(14).background(Theme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
                    .overlay { RoundedRectangle(cornerRadius: 18).stroke(Theme.accent.opacity(0.25), lineWidth: 1) }
            } else if store.isOptedIn {
                Text("Post \(board.window.minimumPosts) times in \(board.window.days) days to enter the rankings.")
                    .font(.caption).foregroundStyle(Theme.secondaryText)
            }
            if !remaining.isEmpty {
                HStack {
                    Text("RANK").tracking(1.5)
                    Spacer()
                    Text("XP").tracking(1.5)
                }.font(.system(size: 9, weight: .semibold)).foregroundStyle(Theme.secondaryText)
                    .padding(.horizontal, 14).padding(.top, 6)
                VStack(spacing: 0) {
                    ForEach(remaining) { entry in
                        inspectable(entry) { LeaderboardRow(entry: entry, isMe: entry.username == username) }
                            .padding(.vertical, 16)
                        if entry.id != remaining.last?.id { Divider().overlay(.white.opacity(0.04)).padding(.leading, 40) }
                    }
                }.padding(.horizontal, 14)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22))
                    .overlay { RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.05), lineWidth: 1) }
            }
            if let error = store.leaderboardError {
                Text(error).font(.caption).foregroundStyle(Theme.danger)
            }
            if !board.niches.isEmpty {
                Menu {
                    Picker("Niche", selection: $niche) {
                        Text("All niches").tag(String?.none)
                        ForEach(board.niches, id: \.self) { Text($0).tag(Optional($0)) }
                    }
                } label: { Label(niche ?? "All niches", systemImage: "line.3.horizontal.decrease").font(.caption).frame(minHeight: 44) }
            }
        }
    }

    /// Tapping an entry opens how its XP for the selected period adds up.
    private func inspectable(_ entry: LeaderboardEntry, @ViewBuilder _ content: () -> some View) -> some View {
        Button { inspecting = entry } label: { content().contentShape(Rectangle()) }
            .buttonStyle(.plain)
            .accessibilityHint("Shows how their XP is calculated")
    }

    private func podium(_ entry: LeaderboardEntry, elevated: Bool) -> some View {
        VStack(spacing: 10) {
            ZStack(alignment: .top) {
                Circle().stroke(Theme.accent.opacity(elevated ? 0.55 : 0.16), lineWidth: 1)
                    .frame(width: elevated ? 72 : 58, height: elevated ? 72 : 58)
                AvatarView(url: entry.avatarUrl, displayName: entry.displayName, size: elevated ? 62 : 48).padding(5)
                if elevated {
                    Image(systemName: "crown.fill").font(.system(size: 13)).foregroundStyle(Theme.accent)
                        .offset(y: -9)
                }
            }
            VStack(spacing: 2) {
                Text(entry.displayName).font(.system(size: 12, weight: .semibold))
                    .lineLimit(1).minimumScaleFactor(0.75)
                if let level = entry.level {
                    Text("LV \(level)").font(.system(size: 9, weight: .bold)).tracking(0.8).foregroundStyle(Theme.accent)
                }
            }
            VStack(spacing: 8) {
                Text(entry.xpLabel)
                    .font(.system(size: elevated ? 30 : 24, weight: .semibold, design: .rounded))
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .tracking(-1).foregroundStyle(elevated ? Theme.accent : .white)
                Text(String(format: "%02d", entry.rank))
                    .font(.system(size: 12, weight: .medium, design: .monospaced)).foregroundStyle(Theme.secondaryText)
            }
            .frame(maxWidth: .infinity).frame(height: elevated ? 112 : 82)
            .background(LinearGradient(colors: [Theme.accent.opacity(elevated ? 0.22 : 0.08), Theme.surface.opacity(0.3)], startPoint: .top, endPoint: .bottom), in: UnevenRoundedRectangle(topLeadingRadius: 18, topTrailingRadius: 18))
            .overlay(alignment: .top) { Capsule().fill(Theme.accent.opacity(elevated ? 0.8 : 0.2)).frame(height: 2).padding(.horizontal, 18) }
        }.frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Rank \(entry.rank), \(entry.displayName), @\(entry.username), \(entry.xpLabel) XP")
    }

    private var optIn: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Take your place.").font(.headline)
                Text("Your handle becomes public. Leave anytime in Settings.").font(.caption).foregroundStyle(Theme.secondaryText)
                if let error = store.participationError { Text(error).font(.caption).foregroundStyle(Theme.danger) }
                PrimaryButton(title: "Join leaderboard", isLoading: store.isUpdatingParticipation) {
                    Task { await store.setOptedIn(true, username: username, timezone: timezone) }
                }
            }
        }
    }

    private func rankingLabel(_ board: Leaderboard) -> String {
        switch filter {
        case .day: "TODAY'S RANKING"
        case .week: "7-DAY RANKING"
        case .all: "\(board.window.days)-DAY RANKING"
        }
    }

    private func load() async {
        await store.loadLeaderboard(filter: filter, niche: niche, username: username)
    }
}

private struct LeaderboardRow: View {
    let entry: LeaderboardEntry
    var isMe = false

    var body: some View {
        HStack(spacing: 12) {
            Text(String(format: "%02d", entry.rank))
                .font(.system(size: 12, weight: .medium, design: .monospaced)).foregroundStyle(Theme.secondaryText).frame(width: 24)
            AvatarView(url: entry.avatarUrl, displayName: entry.displayName, size: 36)
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.displayName).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                HStack(spacing: 5) {
                    Text(isMe ? "You" : "@\(entry.username)")
                        .foregroundStyle(isMe ? Theme.accent : Theme.secondaryText).lineLimit(1)
                    if let level = entry.level {
                        Text("LV \(level)").fontWeight(.bold).foregroundStyle(Theme.accent)
                    }
                }.font(.system(size: 11))
            }
            Spacer(minLength: 0)
            Text(entry.xpLabel)
                .font(.system(size: 20, weight: .medium, design: .rounded)).monospacedDigit().foregroundStyle(Theme.accent)
        }.accessibilityElement(children: .combine)
    }
}

private extension LeaderboardEntry {
    /// Falls back to the post count against a server that predates XP.
    var xpLabel: String { xp.map(\.xpFormatted) ?? "\(postsCounted)" }
}
