import SwiftUI

struct PostSuggestionsSection: View {
    @Environment(AppSession.self) private var session
    @Environment(ViralityStore.self) private var store
    @AppStorage("designPreviewData") private var previewData = DesignPreviewData.enabledByDefault
    @State private var result: PostSuggestions?
    @State private var selected: PostSuggestion?
    @State private var loading = false
    @State private var error: String?
    @State private var editingNiche = false
    @State private var nicheDraft = ""

    private var context: String { "\(session.profile?.username ?? "")|\(store.niche)|\(previewData)" }
    private var shown: PostSuggestions? { previewData ? .preview(niche: store.niche) : result }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("What to post").font(.headline)
                    Text("A little inspiration for your next move.")
                        .font(.caption).foregroundStyle(Theme.secondaryText)
                }
                Spacer()
                Button { Task { await research() } } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 44, height: 44)
                }.disabled(loading || (!previewData && store.niche.isEmpty))
                    .accessibilityLabel("Refresh post ideas")
            }
            HStack {
                Button {
                    nicheDraft = store.niche
                    editingNiche = true
                } label: {
                    Label(store.niche.isEmpty ? "Choose your niche" : store.niche, systemImage: "slider.horizontal.3")
                        .font(.caption.weight(.medium)).lineLimit(1)
                        .padding(.horizontal, 12).frame(minHeight: 36)
                        .background(Theme.accent.opacity(0.1), in: Capsule())
                }
                Spacer()
                Text(previewData ? "SAMPLE IDEAS" : "X RESEARCH")
                    .font(.system(size: 9, weight: .bold)).tracking(1).foregroundStyle(Theme.secondaryText)
            }
            PreviewDataControl(enabled: $previewData)
            if loading {
                HStack(spacing: 12) {
                    ProgressView().tint(Theme.accent)
                    Text("Finding conversations in your niche…").font(.subheadline)
                }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
            }
            if let error { Text(error).font(.footnote).foregroundStyle(Theme.danger) }
            if let shown {
                ForEach(shown.ideas) { idea in
                    Button { selected = idea } label: {
                        SurfaceCard {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Label(idea.topic, systemImage: "sparkles")
                                        .font(.caption.weight(.medium)).foregroundStyle(Theme.accent)
                                    Spacer()
                                    Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(Theme.secondaryText)
                                }
                                Text(idea.title).font(.system(size: 19, weight: .semibold))
                                Text(idea.draft).font(.subheadline).foregroundStyle(Theme.secondaryText).lineLimit(3)
                                Text("Explore idea").font(.caption.weight(.semibold)).foregroundStyle(Theme.accent)
                            }
                        }
                    }.buttonStyle(.plain)
                }
                if shown.ideas.isEmpty {
                    Text("No well-sourced ideas found yet. Try a more specific niche or research again later.")
                        .font(.subheadline).foregroundStyle(Theme.secondaryText)
                }
                if !previewData {
                    Text("Researched \(shown.generatedAt.formatted(.relative(presentation: .named))). Ideas, not guaranteed results.")
                        .font(.caption2).foregroundStyle(Theme.secondaryText)
                }
            } else if !loading {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(store.niche.isEmpty ? "Find your corner of X." : "Turn conversations into ideas.").font(.headline)
                        Text(store.niche.isEmpty ? "Choose a niche to get relevant angles and draft hooks." : "Research recent X posts for timely angles, with links to the source conversations.")
                            .font(.subheadline).foregroundStyle(Theme.secondaryText)
                        if !store.niche.isEmpty {
                            PrimaryButton(title: "Find post ideas") { Task { await research() } }
                        }
                    }
                }
            }
        }
        .task(id: context) { result = nil; error = nil }
        .sheet(item: $selected) { idea in
            PostSuggestionSheet(idea: idea, isPreview: previewData)
                .presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $editingNiche) {
            NavigationStack {
                Form {
                    Section("What do you post about?") {
                        TextField("e.g. indie apps, fitness, product design", text: $nicheDraft)
                            .textInputAutocapitalization(.sentences)
                            .onChange(of: nicheDraft) { _, value in nicheDraft = String(value.prefix(60)) }
                        Text("Be specific. This also updates your Analytics and leaderboard niche.").font(.footnote)
                    }
                }
                .scrollIndicators(.hidden)
                .navigationTitle("Your niche").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { editingNiche = false } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            Task {
                                await store.setNiche(nicheDraft.trimmingCharacters(in: .whitespacesAndNewlines), username: session.profile?.username ?? "", timezone: session.commitment?.timezoneIdentifier ?? TimeZone.current.identifier)
                                editingNiche = false
                            }
                        }.disabled(nicheDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }.presentationDetents([.medium]).tint(Theme.accent)
        }
    }

    @MainActor private func research() async {
        guard !loading else { return }
        guard !previewData else { return }
        let requestContext = context
        loading = true
        error = nil
        defer { loading = false }
        do {
            let response = try await URLSessionViralityClient(baseURL: AppConfiguration.apiBaseURL)
                .fetchSuggestions(username: session.profile?.username ?? "", niche: store.niche)
            guard context == requestContext else { return }
            result = response
        } catch {
            guard context == requestContext else { return }
            self.error = error.localizedDescription
        }
    }
}

private struct PostSuggestionSheet: View {
    let idea: PostSuggestion
    let isPreview: Bool
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ""
    @State private var copied = false

    private var composeURL: URL {
        var url = URLComponents(string: "https://x.com/intent/post")!
        url.queryItems = [URLQueryItem(name: "text", value: draft)]
        return url.url!
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    Text(isPreview ? "SAMPLE IDEA" : "\(idea.topic.uppercased())")
                        .font(.caption.weight(.bold)).tracking(1).foregroundStyle(Theme.accent)
                    Text(idea.title).font(.system(size: 27, weight: .semibold))
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Your draft").font(.headline)
                        TextEditor(text: $draft).frame(minHeight: 130).scrollContentBackground(.hidden)
                            .padding(12).background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                            .accessibilityLabel("Edit post draft")
                        Text("Make it yours. Replace any placeholders before posting.").font(.caption).foregroundStyle(Theme.secondaryText)
                    }
                    Text("Why this angle").font(.headline)
                    Text(idea.whyNow).font(.subheadline).foregroundStyle(Theme.secondaryText)
                    Text(idea.angle).font(.subheadline)
                    if !idea.sourceUrls.isEmpty {
                        Text("Source conversations").font(.headline)
                        ForEach(Array(idea.sourceUrls.enumerated()), id: \.offset) { index, url in
                            Link(destination: url) { Label("Read source \(index + 1) on X", systemImage: "arrow.up.right.square") }
                        }
                    }
                    HStack(spacing: 16) {
                        Button { UIPasteboard.general.string = draft; copied = true } label: {
                            Label(copied ? "Copied" : "Copy draft", systemImage: copied ? "checkmark" : "doc.on.doc")
                        }.frame(minHeight: 44)
                        Spacer()
                        Link(destination: composeURL) { Label("Open in X", systemImage: "arrow.up.right") }
                            .buttonStyle(.borderedProminent).foregroundStyle(Theme.background)
                    }
                }.padding(24)
            }.background(Theme.background)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .tint(Theme.accent)
        .onAppear { draft = idea.draft }
        .onChange(of: draft) { _, _ in copied = false }
    }
}

struct ProfileHeader: View {
    let profile: PostingProfile?
    let date: Date
    let timezone: TimeZone
    let streak: Int
    let openStreak: () -> Void

    private var greeting: String {
        var calendar = Calendar.current
        calendar.timeZone = timezone
        switch calendar.component(.hour, from: date) {
        case 5..<12: return "Good morning,"
        case 12..<17: return "Good afternoon,"
        default: return "Good evening,"
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(url: profile?.avatarURL, displayName: profile?.displayName ?? "Creator", size: 48)
            VStack(alignment: .leading, spacing: 3) {
                Text(greeting).font(.system(size: 16, weight: .medium))
                Text(profile?.displayName ?? "Creator")
                    .font(.system(size: 19, weight: .semibold)).foregroundStyle(Theme.accent)
                    .lineLimit(1).truncationMode(.tail)
            }.frame(maxWidth: .infinity, alignment: .leading)
            Button(action: openStreak) { StreakBadge(count: streak) }
                .buttonStyle(.plain)
                .accessibilityLabel("\(streak) day streak. View streak details")
        }
    }
}

struct StreakBadge: View {
    let count: Int

    var body: some View {
        HStack(spacing: 5) {
            Image("StreakFlame").resizable().scaledToFit().frame(width: 24, height: 28)
                .accessibilityHidden(true)
            Text(count.formatted()).font(.system(size: 18, weight: .bold)).monospacedDigit()
        }
        .padding(.horizontal, 12).frame(minHeight: 44)
        .background(Theme.accent.opacity(0.08), in: Capsule())
        .overlay { Capsule().stroke(Theme.accent.opacity(0.16), lineWidth: 1) }
    }
}

struct StreakDetailView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: session.commitment?.timezoneIdentifier ?? "") ?? .current
        return calendar
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
            VStack(spacing: 20) {
                Image("StreakFlame").resizable().scaledToFit().frame(width: 100, height: 112)
                    .accessibilityHidden(true)
                Text("\(session.currentStreak()) day streak")
                    .font(.system(size: 30, weight: .semibold)).tracking(-0.8)
                Text(session.currentStreak() == 0 ? "Complete today's goal to light your first flame." : "One day at a time. Keep your momentum going.")
                    .font(.subheadline).foregroundStyle(Theme.secondaryText).multilineTextAlignment(.center)
                HStack(spacing: 0) {
                    ForEach(0..<7) { offset in
                        let day = calendar.date(byAdding: .day, value: offset - 6, to: .now) ?? .now
                        let complete = session.completedGoal(on: day)
                        VStack(spacing: 10) {
                            Text(calendar.veryShortWeekdaySymbols[calendar.component(.weekday, from: day) - 1])
                                .font(.caption).foregroundStyle(Theme.secondaryText)
                            Image(systemName: complete ? "checkmark" : "minus")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(complete ? Theme.background : Theme.secondaryText)
                                .frame(width: 32, height: 32)
                                .background(complete ? Theme.accent : Theme.secondarySurface, in: Circle())
                        }.frame(maxWidth: .infinity)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("\(day.formatted(date: .abbreviated, time: .omitted)), \(complete ? "goal completed" : "no completion recorded")")
                    }
                }.padding(16).background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
                Text("Meet your full goal on each posting day. Rest days preserve your streak. Progress is recorded on this device.")
                    .font(.caption).foregroundStyle(Theme.secondaryText).multilineTextAlignment(.center)
            }
            .padding(24).frame(maxWidth: .infinity)
            }
            .background(Theme.background)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }.tint(Theme.accent)
    }
}

struct PreviewDataControl: View {
    @Binding var enabled: Bool

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: enabled ? "sparkles" : "antenna.radiowaves.left.and.right")
                .foregroundStyle(Theme.accent)
            Text(enabled ? "Sample data · design preview" : "Your live data")
                .font(.caption)
            Spacer()
            Button(enabled ? "Go live" : "Preview") { enabled.toggle() }
                .font(.caption.weight(.semibold)).foregroundStyle(Theme.accent)
                .frame(minHeight: 44)
        }
        .foregroundStyle(Theme.secondaryText)
    }
}

struct DashboardHeading<Accessory: View>: View {
    let title: String
    @ViewBuilder var accessory: Accessory

    init(title: String, @ViewBuilder accessory: () -> Accessory = { EmptyView() }) {
        self.title = title
        self.accessory = accessory()
    }

    var body: some View {
        HStack(spacing: 10) {
            Text(title).font(.system(size: 28, weight: .semibold)).tracking(-1).lineLimit(1).minimumScaleFactor(0.8)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            accessory
        }.frame(minHeight: 44).padding(.top, 12)
    }
}

struct PrimaryButton: View {
    let title: String
    var isLoading = false
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.small) {
                if isLoading {
                    ProgressView().tint(.black)
                }
                Text(title).fontWeight(.bold)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 54)
            .foregroundStyle(.black)
            .background(Theme.accent.opacity(isDisabled ? 0.45 : 1), in: RoundedRectangle(cornerRadius: 16))
        }
        .disabled(isDisabled || isLoading)
        .accessibilityLabel(isLoading ? "\(title), loading" : title)
    }
}

struct SurfaceCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(Spacing.large)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22))
            .overlay {
                RoundedRectangle(cornerRadius: 22)
                    .stroke(.white.opacity(0.07), lineWidth: 1)
            }
    }
}

struct AvatarView: View {
    let url: URL?
    let displayName: String
    var size: CGFloat = 64

    var body: some View {
        AsyncImage(url: url) { phase in
            if case let .success(image) = phase {
                image.resizable().scaledToFill()
            } else {
                ZStack {
                    Theme.secondarySurface
                    Text(displayName.prefix(1).uppercased())
                        .font(.system(size: size * 0.4, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay { Circle().stroke(.white.opacity(0.12), lineWidth: 1) }
        .accessibilityLabel("\(displayName)'s profile photo")
    }
}

struct VerificationBadge: View {
    let type: PostingProfile.VerificationType?

    private var color: Color {
        switch type {
        case .organization: Color(red: 0.94, green: 0.73, blue: 0.13)
        case .government: Color(red: 0.72, green: 0.75, blue: 0.79)
        case .individual, .none: Color(red: 0.12, green: 0.63, blue: 0.95)
        }
    }

    private var label: String {
        switch type {
        case .organization: "Verified organization"
        case .government: "Verified government account"
        case .individual, .none: "X Premium"
        }
    }

    var body: some View {
        Image(systemName: "checkmark.seal.fill")
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(color)
            .accessibilityLabel(label)
    }
}
