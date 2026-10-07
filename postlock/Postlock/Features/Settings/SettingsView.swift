import FamilyControls
import SwiftUI

struct SettingsView: View {
    @Environment(AppSession.self) private var session
    @Environment(PurchasesService.self) private var purchases
    @Environment(ViralityStore.self) private var virality
    @Environment(\.openURL) private var openURL
    @State private var nicheDraft = ""
    @State private var showChangeConfirmation = false
    @State private var showUsernameSetup = false
    @State private var showScheduleSetup = false
    @State private var showAppPicker = false

    var body: some View {
        List {
            DashboardHeading(title: "Settings")
                .listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 12, trailing: 0))
            accountSection.listRowBackground(Theme.surface)
            subscriptionSection.listRowBackground(Theme.surface)
            commitmentSection.listRowBackground(Theme.surface)
            remindersSection.listRowBackground(Theme.surface)
            leaderboardSection.listRowBackground(Theme.surface)
            blockingSection.listRowBackground(Theme.surface)
            simulatorSection.listRowBackground(Theme.surface)
            privacySection.listRowBackground(Theme.surface)
        }
        .toolbar(.hidden, for: .navigationBar)
        .listRowSpacing(0)
        .scrollContentBackground(.hidden)
        .scrollIndicators(.hidden)
        .background(Theme.background)
        .confirmationDialog(
            "Change X username?",
            isPresented: $showChangeConfirmation,
            titleVisibility: .visible
        ) {
            Button("Change Username") { showUsernameSetup = true }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Future posting checks will use the new username.")
        }
        .sheet(isPresented: $showUsernameSetup) {
            NavigationStack { UsernameSetupView(mode: .change) }
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showScheduleSetup) {
            NavigationStack { ScheduleSetupView(initialCommitment: session.commitment) }
                .presentationDragIndicator(.visible)
        }
        .allowedAppPicker(isPresented: $showAppPicker, selection: Bindable(session.screenTime).selection)
    }

    private var accountSection: some View {
        Section("Account") {
            HStack(spacing: Spacing.medium) {
                if let profile = session.profile {
                    AvatarView(url: profile.avatarURL, displayName: profile.displayName, size: 44)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(session.profile?.displayName ?? "Your account").font(.headline)
                    Text("@\(session.profile?.username ?? "")").font(.subheadline).foregroundStyle(Theme.secondaryText)
                }
                Spacer()
                Button("Change") { showChangeConfirmation = true }.fontWeight(.semibold)
            }
            .padding(.vertical, 6)
        }
    }

    private var subscriptionSection: some View {
        Section("Subscription") {
            HStack {
                Text(purchases.isPro ? "Postlock Pro" : "Not subscribed")
                Spacer()
                Link("Manage", destination: URL(string: "https://apps.apple.com/account/subscriptions")!)
                    .fontWeight(.semibold)
            }
        }
    }

    @ViewBuilder
    private var commitmentSection: some View {
        Section("Schedule") {
            if let commitment = session.commitment {
                Button { showScheduleSetup = true } label: {
                    NavigationRow {
                        Text("\(commitment.goal) post\(commitment.goal == 1 ? "" : "s") a day").foregroundStyle(.white)
                        Text("\(postingDaysSummary(commitment.postingDays)) · \(commitment.deadlineMinutes.map(timeString).joined(separator: ", "))")
                            .font(.caption).foregroundStyle(Theme.secondaryText)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var remindersSection: some View {
        let notifications = session.notifications
        Section {
            switch notifications.authorizationStatus {
            case .notDetermined:
                Button {
                    Task {
                        await notifications.requestAuthorization()
                        session.refreshReminders()
                    }
                } label: {
                    Label("Turn on deadline reminders", systemImage: "bell.badge")
                }
            case .denied:
                Button {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                } label: {
                    Label("Reminders are off. Turn on in Settings", systemImage: "bell.slash")
                        .foregroundStyle(Theme.danger)
                }
            default:
                let preferences = Bindable(notifications).preferences
                Toggle("Warn me before apps lock", isOn: preferences.deadlineWarnings)
                if notifications.preferences.deadlineWarnings {
                    Picker("First warning", selection: preferences.firstWarningMinutes) {
                        ForEach(ReminderPreferences.firstWarningOptions, id: \.self) { minutes in
                            Text(minutes < 60 ? "\(minutes) min before" : "\(minutes / 60) hr before").tag(minutes)
                        }
                    }
                }
                Toggle("Morning plan", isOn: preferences.morningPlan)
                Toggle("Check in when I'm away", isOn: preferences.awayCheckIns)
            }
        } header: {
            Text("Reminders")
        } footer: {
            Text("A final warning comes \(ReminderPlanner.finalWarningMinutes) minutes before each deadline. Deadlines you've missed lately get an earlier heads-up, and on a long streak you get fewer pings.")
        }
    }

    private var leaderboardSection: some View {
        Section("Leaderboard") {
            Toggle("Show me publicly", isOn: Binding(
                get: { virality.isOptedIn },
                set: { optedIn in Task { await virality.setOptedIn(optedIn, username: username, timezone: timezone) } }
            ))
            .disabled(virality.isUpdatingParticipation)
            TextField("Your niche, e.g. indie SaaS", text: $nicheDraft)
                .textInputAutocapitalization(.never)
                .submitLabel(.done)
                .onSubmit { saveNiche() }
            if let error = virality.participationError {
                Text(error).font(.footnote).foregroundStyle(Theme.danger)
            }
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
        Section("App blocking") {
            if session.screenTime.authorizationStatus != .approved {
                Button {
                    Task {
                        do {
                            try await session.screenTime.requestAuthorization()
                        } catch {
                            // Already denied: iOS won't ask again, only Settings can change it.
                            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                        }
                    }
                } label: {
                    Label("Allow Screen Time", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.danger)
                }
            }
            Button { showAppPicker = true } label: {
                NavigationRow {
                    Text("Kept open when locked").foregroundStyle(.white)
                    AllowedAppStatus(token: session.screenTime.allowedAppToken, issue: session.screenTime.allowedAppIssue)
                        .font(.caption)
                }
            }
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
        }
        #endif
    }

    private var privacySection: some View {
        Section {
            Label("Public posts only. We never touch your X account.", systemImage: "lock.shield")
                .font(.footnote).foregroundStyle(Theme.secondaryText)
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

/// A settings row that opens something: stacked text with a trailing chevron.
private struct NavigationRow<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) { content }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Theme.secondaryText)
        }
        .contentShape(Rectangle())
    }
}
