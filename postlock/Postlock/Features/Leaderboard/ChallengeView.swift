import SwiftUI

struct ChallengeHubView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ViralityStore.self) private var store
    let username: String
    let leaderboard: [LeaderboardEntry]
    @State private var showingPicker = false

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 18) {
                    if !store.challengeInvitations.isEmpty {
                        sectionLabel("YOUR MOVE", icon: "envelope.badge")
                        ForEach(store.challengeInvitations) { challenge in
                            ChallengeInvitationCard(challenge: challenge, username: username)
                        }
                    }

                    if !store.outgoingChallenges.isEmpty {
                        sectionLabel("AWAITING RESPONSE", icon: "hourglass")
                        ForEach(store.outgoingChallenges) { challenge in
                            PendingChallengeCard(challenge: challenge)
                        }
                    }

                    sectionLabel("LIVE ARENA", icon: "bolt.fill")
                    if store.activeChallenges.isEmpty {
                        emptyArena
                    } else {
                        ForEach(store.activeChallenges) { challenge in
                            ChallengeBattleCard(challenge: challenge, username: username)
                        }
                    }

                    if !store.completedChallenges.isEmpty {
                        sectionLabel("RECENT RESULTS", icon: "trophy.fill")
                        ForEach(store.completedChallenges.prefix(3)) { challenge in
                            ChallengeBattleCard(challenge: challenge, username: username)
                        }
                    }

                    if let error = store.challengeError {
                        Text(error).font(.footnote).foregroundStyle(Theme.danger)
                    }

                    Button { showingPicker = true } label: {
                        Label("Start a new challenge", systemImage: "plus")
                            .font(.headline).frame(maxWidth: .infinity).frame(minHeight: 54)
                            .foregroundStyle(.black)
                            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 16))
                    }.buttonStyle(.plain)
                }
                .padding(20).padding(.bottom, 20)
            }
            .background(Theme.background)
            .navigationTitle("Challenges")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .refreshable { await store.loadChallenges(username: username) }
            .task { await store.loadChallenges(username: username) }
            .sheet(isPresented: $showingPicker) {
                NewChallengeView(username: username, leaderboard: leaderboard)
                    .presentationDetents([.large]).presentationDragIndicator(.visible)
            }
        }.tint(Theme.accent)
    }

    private func sectionLabel(_ text: String, icon: String) -> some View {
        Label(text, systemImage: icon).font(.system(size: 10, weight: .bold)).tracking(1.6)
            .foregroundStyle(Theme.secondaryText)
    }

    private var emptyArena: some View {
        VStack(spacing: 14) {
            Image("ChallengeDuel").resizable().scaledToFit().frame(height: 116)
            Text("Call out a creator.").font(.title3.weight(.semibold))
            Text("Pick anyone on X. Whoever posts more before time runs out wins.")
                .font(.subheadline).foregroundStyle(Theme.secondaryText).multilineTextAlignment(.center)
        }
        .padding(22).frame(maxWidth: .infinity)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 24))
        .overlay { RoundedRectangle(cornerRadius: 24).stroke(.white.opacity(0.06)) }
    }
}

private struct PendingChallengeCard: View {
    let challenge: PostingChallenge

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(url: challenge.opponent.avatarUrl, displayName: challenge.opponent.displayName, size: 46)
            VStack(alignment: .leading, spacing: 4) {
                Text("Waiting for @\(challenge.opponent.username)")
                    .font(.subheadline.weight(.semibold)).lineLimit(1)
                Text("\(challenge.duration.title) duel · invitation sent")
                    .font(.caption).foregroundStyle(Theme.secondaryText)
            }
            Spacer(minLength: 8)
            Image(systemName: "hourglass")
                .foregroundStyle(Theme.accent)
                .accessibilityHidden(true)
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
        .overlay { RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.06)) }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Waiting for \(challenge.opponent.displayName) to respond to your \(challenge.duration.title.lowercased()) duel")
    }
}

private struct ChallengeBattleCard: View {
    let challenge: PostingChallenge
    let username: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var energized = false

    private var firstLeading: Bool { challenge.challenger.score > challenge.opponent.score }
    private var secondLeading: Bool { challenge.opponent.score > challenge.challenger.score }

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Label(challenge.duration == .day ? "DAILY DUEL" : "WEEKLY DUEL", systemImage: "bolt.fill")
                    .font(.system(size: 10, weight: .bold)).tracking(1.4).foregroundStyle(Theme.accent)
                Spacer()
                if challenge.status == .completed {
                    Text("FINAL").font(.system(size: 10, weight: .bold)).tracking(1.2).foregroundStyle(Theme.mint)
                } else {
                    Text(timerInterval: Date.now...challenge.endsAt, countsDown: true)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced)).monospacedDigit()
                        .foregroundStyle(Theme.secondaryText)
                }
            }

            ZStack {
                Image("ChallengeDuel").resizable().scaledToFit().frame(height: 105)
                    .opacity(0.7).scaleEffect(energized ? 1.04 : 0.96)
                HStack(spacing: 0) {
                    competitor(challenge.challenger, leading: firstLeading)
                    Text("VS").font(.system(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(.black).frame(width: 34, height: 34)
                        .background(Theme.accent, in: Circle())
                        .shadow(color: Theme.accent.opacity(0.45), radius: 14)
                    competitor(challenge.opponent, leading: secondLeading)
                }
            }

            GeometryReader { proxy in
                let total = max(1, challenge.challenger.score + challenge.opponent.score)
                HStack(spacing: 3) {
                    Capsule().fill(firstLeading ? Theme.accent : Theme.accent.opacity(0.3))
                        .frame(width: max(8, proxy.size.width * CGFloat(challenge.challenger.score) / CGFloat(total)))
                    Capsule().fill(secondLeading ? Theme.mint : Theme.mint.opacity(0.3))
                }
            }.frame(height: 5).animation(.spring(duration: 0.45, bounce: 0.2), value: challenge)

            HStack {
                Image(systemName: challenge.status == .completed ? "trophy.fill" : "lock.display").foregroundStyle(Theme.mint)
                Text(challenge.status == .completed ? "Challenge complete" : "Live on your Lock Screen")
                Spacer()
                Text(challenge.person(for: username).score > challenge.rival(for: username).score ? "YOU'RE LEADING" : challenge.person(for: username).score == challenge.rival(for: username).score ? "TIED UP" : "CATCH THEM")
                    .font(.system(size: 9, weight: .bold)).tracking(0.8).foregroundStyle(Theme.accent)
            }.font(.caption).foregroundStyle(Theme.secondaryText)
        }
        .padding(18)
        .background(LinearGradient(colors: [Theme.accent.opacity(0.14), Theme.surface, Theme.mint.opacity(0.06)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 26))
        .overlay { RoundedRectangle(cornerRadius: 26).stroke(Theme.accent.opacity(0.2)) }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) { energized = true }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Challenge. \(challenge.challenger.displayName), \(challenge.challenger.score) posts. \(challenge.opponent.displayName), \(challenge.opponent.score) posts.")
    }

    private func competitor(_ person: ChallengePerson, leading: Bool) -> some View {
        VStack(spacing: 8) {
            ZStack(alignment: .topTrailing) {
                AvatarView(url: person.avatarUrl, displayName: person.displayName, size: 64)
                    .overlay { Circle().stroke(leading ? Theme.mint : .white.opacity(0.14), lineWidth: leading ? 3 : 1) }
                    .shadow(color: leading ? Theme.mint.opacity(0.35) : .clear, radius: 12)
                if leading {
                    Image(systemName: "crown.fill").font(.system(size: 12)).foregroundStyle(.black)
                        .padding(6).background(Theme.mint, in: Circle()).offset(x: 4, y: -4)
                }
            }
            Text(person.displayName).font(.caption.weight(.semibold)).lineLimit(1)
            Text("\(person.score)").font(.system(size: 34, weight: .bold, design: .rounded)).monospacedDigit()
                .foregroundStyle(leading ? Theme.mint : .white).contentTransition(.numericText())
            Text(person.score == 1 ? "POST" : "POSTS").font(.system(size: 8, weight: .bold)).tracking(1.2)
                .foregroundStyle(Theme.secondaryText)
        }.frame(maxWidth: .infinity)
    }
}

private struct ChallengeInvitationCard: View {
    @Environment(ViralityStore.self) private var store
    let challenge: PostingChallenge
    let username: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                AvatarView(url: challenge.challenger.avatarUrl, displayName: challenge.challenger.displayName, size: 48)
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(challenge.challenger.displayName) challenged you")
                        .font(.subheadline.weight(.semibold))
                    Text("Most posts in \(challenge.duration.title.lowercased()) wins")
                        .font(.caption).foregroundStyle(Theme.secondaryText)
                }
            }
            HStack(spacing: 10) {
                Button("Not now") { Task { await store.respond(to: challenge, username: username, accept: false) } }
                    .frame(maxWidth: .infinity).frame(minHeight: 46).background(Theme.secondarySurface, in: RoundedRectangle(cornerRadius: 14))
                Button("Accept duel") { Task { await store.respond(to: challenge, username: username, accept: true) } }
                    .fontWeight(.bold).foregroundStyle(.black).frame(maxWidth: .infinity).frame(minHeight: 46)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
            }.buttonStyle(.plain).disabled(store.isUpdatingChallenge)
        }.padding(16).background(Theme.surface, in: RoundedRectangle(cornerRadius: 22))
    }
}

private struct NewChallengeView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ViralityStore.self) private var store
    let username: String
    let leaderboard: [LeaderboardEntry]
    @State private var query = ""
    @State private var selected: LeaderboardEntry?
    @State private var duration: PostingChallenge.Duration = .day

    private var handle: String {
        (selected?.username ?? query).trimmingCharacters(in: CharacterSet(charactersIn: "@ ")).lowercased()
    }

    private var results: [LeaderboardEntry] {
        leaderboard.filter { entry in
            entry.username != username && (query.isEmpty || entry.username.localizedCaseInsensitiveContains(query) || entry.displayName.localizedCaseInsensitiveContains(query))
        }
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Pick your rival").font(.title2.weight(.semibold))
                    Text("Choose someone from the leaderboard or enter any public X handle.")
                        .font(.subheadline).foregroundStyle(Theme.secondaryText)
                }
                TextField("@username", text: $query)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .padding(14).background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                    .onChange(of: query) { _, _ in selected = nil }
                HStack(spacing: 8) {
                    ForEach(PostingChallenge.Duration.allCases) { option in
                        Button { duration = option } label: {
                            Text(option.title).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).frame(height: 44)
                                .background(duration == option ? Theme.accent : Theme.surface, in: Capsule())
                                .foregroundStyle(duration == option ? .black : Theme.secondaryText)
                        }.buttonStyle(.plain)
                    }
                }
                Text("TOP CREATORS").font(.system(size: 9, weight: .bold)).tracking(1.5).foregroundStyle(Theme.secondaryText)
                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: 4) {
                        ForEach(results.prefix(8)) { entry in
                            Button { selected = entry; query = "@\(entry.username)" } label: {
                                HStack(spacing: 12) {
                                    AvatarView(url: entry.avatarUrl, displayName: entry.displayName, size: 38)
                                    VStack(alignment: .leading) {
                                        Text(entry.displayName).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                                        Text("@\(entry.username) · \(entry.postsCounted) posts").font(.caption).foregroundStyle(Theme.secondaryText)
                                    }
                                    Spacer()
                                    Image(systemName: selected?.id == entry.id ? "checkmark.circle.fill" : "plus.circle")
                                        .foregroundStyle(Theme.accent)
                                }.padding(10).background(selected?.id == entry.id ? Theme.accent.opacity(0.08) : .clear, in: RoundedRectangle(cornerRadius: 14))
                            }.buttonStyle(.plain)
                        }
                    }
                }
                if let error = store.challengeError { Text(error).font(.caption).foregroundStyle(Theme.danger) }
                PrimaryButton(title: store.isUpdatingChallenge ? "Starting duel..." : "Send challenge", isLoading: store.isUpdatingChallenge, isDisabled: handle.isEmpty || handle == username) {
                    Task {
                        if await store.createChallenge(challenger: username, opponent: handle, duration: duration) { dismiss() }
                    }
                }
            }.padding(20).background(Theme.background)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }.tint(Theme.accent).preferredColorScheme(.dark)
    }
}
