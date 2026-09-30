import FamilyControls
import SwiftUI

struct SettingsView: View {
    @Environment(AppSession.self) private var session
    @Environment(PurchasesService.self) private var purchases
    @Environment(ViralityStore.self) private var virality
    @State private var nicheDraft = ""
    @State private var showChangeConfirmation = false
    @State private var showUsernameSetup = false
    @State private var showScheduleSetup = false
    @State private var showAppPicker = false

    var body: some View {
        List {
            accountSection
            subscriptionSection
            commitmentSection
            leaderboardSection
            blockingSection
            simulatorSection
            privacySection
        }
        .navigationTitle("Settings")
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .confirmationDialog(
            "Change X username?",
            isPresented: $showChangeConfirmation,
            titleVisibility: .visible
        ) {
            Button("Change Username") { showUsernameSetup = true }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your future posting checks will use the new username. Previous history will remain attached to your POSTLOCK account.")
        }
        .sheet(isPresented: $showUsernameSetup) {
            NavigationStack { UsernameSetupView(mode: .change) }
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showScheduleSetup) {
            NavigationStack { ScheduleSetupView(initialCommitment: session.commitment) }
                .presentationDragIndicator(.visible)
        }
        .familyActivityPicker(isPresented: $showAppPicker, selection: Bindable(session.screenTime).selection)
    }

    private var accountSection: some View {
        Section("Account") {
            HStack(spacing: Spacing.medium) {
                if let profile = session.profile {
                    AvatarView(url: profile.avatarURL, displayName: profile.displayName, size: 44)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text("X Username").font(.subheadline).foregroundStyle(Theme.secondaryText)
                    Text("@\(session.profile?.username ?? "")").font(.body.weight(.semibold))
                }
                Spacer()
                Button("Change") { showChangeConfirmation = true }.fontWeight(.semibold)
            }
            .padding(.vertical, 6)
        }
    }

    private var subscriptionSection: some View {
        Section("Subscription") {
            LabeledContent("Status", value: purchases.isPro ? "Postlock Pro" : "Not subscribed")
            Link("Manage Subscription", destination: URL(string: "https://apps.apple.com/account/subscriptions")!)
        }
    }

    @ViewBuilder
    private var commitmentSection: some View {
        Section("Posting commitment") {
            if let commitment = session.commitment {
                LabeledContent("Daily goal", value: "\(commitment.goal) post\(commitment.goal == 1 ? "" : "s")")
                LabeledContent("Deadlines", value: commitment.deadlineMinutes.map(timeString).joined(separator: ", "))
                LabeledContent("Posting days", value: postingDaysSummary(commitment.postingDays))
                Button("Change Schedule") { showScheduleSetup = true }
            }
        }
    }

    private var leaderboardSection: some View {
        Section {
            Toggle("Show me on the leaderboard", isOn: Binding(
                get: { virality.isOptedIn },
                set: { optedIn in Task { await virality.setOptedIn(optedIn, username: username, timezone: timezone) } }
            ))
            .disabled(virality.isUpdatingParticipation)
            TextField("Your niche, e.g. indie SaaS growth", text: $nicheDraft)
                .textInputAutocapitalization(.never)
                .submitLabel(.done)
                .onSubmit { saveNiche() }
            if let error = virality.participationError {
                Text(error).font(.footnote).foregroundStyle(Theme.danger)
            }
        } header: {
            Text("Scoring & leaderboard")
        } footer: {
            Text("Your niche helps POSTLOCK judge whether a post fits your lane. You're only ranked publicly if you opt in, and turning this off removes you right away.")
        }
        .onAppear { nicheDraft = virality.niche }
        .onDisappear { saveNiche() }
    }

    private var username: String { session.profile?.username ?? "" }
    private var timezone: String { session.commitment?.timezoneIdentifier ?? TimeZone.current.identifier }

    private func saveNiche() {
        let trimmed = nicheDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed != virality.niche else { return }
        Task { await virality.setNiche(trimmed, username: username, timezone: timezone) }
    }

    private var blockingSection: some View {
        Section {
            LabeledContent("Screen Time", value: authorizationLabel)
            LabeledContent("Allowed while locked", value: session.screenTime.hasValidXException ? "X / Twitter" : "Not configured")
            Button("Choose X / Twitter") { showAppPicker = true }
        } header: {
            Text("App blocking")
        } footer: {
            Text("Choose only X. After a missed deadline, every other app is blocked. Apple keeps the selection private and POSTLOCK stores it only on this device.")
        }
    }

    @ViewBuilder
    private var simulatorSection: some View {
        #if DEBUG && targetEnvironment(simulator)
        Section("Simulator testing") {
            Stepper(
                "Verified posts: \(session.verifiedCount)",
                value: Binding(get: { session.verifiedCount }, set: { session.setVerifiedCount($0) }),
                in: 0 ... (session.commitment?.goal ?? 0)
            )
            Button("Simulate missed deadline") { session.simulateMissedDeadline() }
            Button("Simulate verification success") { session.simulateVerifiedPost() }
            Text("These controls test POSTLOCK's UI and state transitions. Apple app shields require a physical iPhone.")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
        #endif
    }

    private var privacySection: some View {
        Section("Privacy") {
            Label("We only check public posts from the username you provide.", systemImage: "eye")
            Label("We never post, like, follow, or access your X account.", systemImage: "lock.shield")
        }
    }

    private var authorizationLabel: String {
        switch session.screenTime.authorizationStatus {
        case .approved: "Allowed"
        case .denied: "Not allowed"
        case .notDetermined: "Not requested"
        @unknown default: "Unknown"
        }
    }

    private func timeString(_ minutes: Int) -> String {
        let date = Calendar.current.date(byAdding: .minute, value: minutes, to: Calendar.current.startOfDay(for: .now)) ?? .now
        return date.formatted(date: .omitted, time: .shortened)
    }

    private func postingDaysSummary(_ days: Set<Int>) -> String {
        if days.count == 7 { return "Every day" }
        return days.sorted().map { Calendar.current.shortWeekdaySymbols[$0 - 1] }.joined(separator: ", ")
    }
}
