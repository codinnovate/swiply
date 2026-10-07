import FamilyControls
import SwiftUI

struct ScheduleSetupView: View {
    enum Step: Int { case frequency, days, permission, apps }

    @Environment(AppSession.self) private var session
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @State private var step: Step = .frequency
    @State private var commitment: PostingCommitment
    @State private var customGoal = 4
    @State private var showingCustomGoal = false
    @State private var showingPicker = false
    @State private var permissionError: String?

    private let isEditing: Bool
    /// Set during onboarding: the finished plan is handed back instead of activated,
    /// so blocking only starts after the paywall.
    private let onboardingFinish: ((PostingCommitment) -> Void)?

    init(initialCommitment: PostingCommitment? = nil, onboardingFinish: ((PostingCommitment) -> Void)? = nil) {
        _commitment = State(initialValue: initialCommitment ?? .suggested(goal: 3))
        _customGoal = State(initialValue: initialCommitment?.goal ?? 4)
        isEditing = initialCommitment != nil
        self.onboardingFinish = onboardingFinish
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            switch step {
            case .frequency: frequencyView
            case .days: daysView
            case .permission: permissionView
            case .apps: appSelectionView
            }
        }
        .navigationBarBackButtonHidden()
        .onAppear {
            #if DEBUG
            if ProcessInfo.processInfo.environment["POSTLOCK_UI_TEST_SCENARIO"] == "schedule" {
                step = .frequency
            }
            #endif
        }
        .allowedAppPicker(isPresented: $showingPicker, selection: Bindable(session.screenTime).selection)
        .sheet(isPresented: $showingCustomGoal) {
            NavigationStack {
                Form {
                    Stepper("\(customGoal) posts per day", value: $customGoal, in: 1 ... 10)
                }
                .scrollIndicators(.hidden)
                .navigationTitle("Custom Goal")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            commitment = .suggested(goal: customGoal, timezoneIdentifier: commitment.timezoneIdentifier)
                            showingCustomGoal = false
                        }
                    }
                }
            }
            .presentationDetents([.medium])
        }
    }

    private var frequencyView: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.extraLarge) {
                stepHeader(.frequency)
                VStack(alignment: .leading, spacing: Spacing.small) {
                    Text("How often do you want to post?")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                    Text("Each deadline is the time by which your total posts are due. You can post earlier.")
                        .foregroundStyle(Theme.secondaryText)
                }

                HStack(spacing: Spacing.small) {
                    ForEach([1, 2, 3, 5], id: \.self) { goal in
                        frequencyButton(goal)
                    }
                }

                Button {
                    showingCustomGoal = true
                } label: {
                    Label("Custom goal (up to 10)", systemImage: "slider.horizontal.3")
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(Theme.accent)

                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(commitment.deadlineMinutes.indices, id: \.self) { index in
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("POST \(index + 1)")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(Theme.accent)
                                    Text("At least \(index + 1) post\(index == 0 ? "" : "s") by")
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.secondaryText)
                                }
                                Spacer()
                                DatePicker("Deadline \(index + 1)", selection: deadlineBinding(index), displayedComponents: .hourAndMinute)
                                    .labelsHidden()
                            }
                            .padding(.vertical, 12)
                            if index < commitment.deadlineMinutes.count - 1 { Divider().overlay(.white.opacity(0.08)) }
                        }
                    }
                }

                Label(TimeZone.current.identifier, systemImage: "globe")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)

                PrimaryButton(title: "Continue") { go(to: .days) }
            }
            .padding(Spacing.extraLarge)
        }
    }

    private var daysView: some View {
        VStack(alignment: .leading, spacing: Spacing.extraLarge) {
            stepHeader(.days)
            VStack(alignment: .leading, spacing: Spacing.small) {
                Text("Which days will you post?")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text("Apps only lock on the days you pick. Rest days never count against your streak.")
                    .foregroundStyle(Theme.secondaryText)
            }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: Spacing.medium) {
                        Text("POSTING DAYS")
                            .font(.caption.weight(.black))
                            .tracking(1.5)
                            .foregroundStyle(Theme.secondaryText)
                        HStack(spacing: 6) {
                            ForEach(Array(Calendar.current.veryShortWeekdaySymbols.enumerated()), id: \.offset) { offset, symbol in
                                let weekday = offset + 1
                                Button { togglePostingDay(weekday) } label: {
                                    Text(symbol)
                                        .font(.caption.weight(.bold))
                                        .frame(maxWidth: .infinity, minHeight: 38)
                                        .foregroundStyle(commitment.postingDays.contains(weekday) ? .black : .white)
                                        .background(commitment.postingDays.contains(weekday) ? Theme.accent : Theme.secondarySurface, in: Circle())
                                }
                                .accessibilityLabel(Calendar.current.weekdaySymbols[offset])
                                .accessibilityValue(commitment.postingDays.contains(weekday) ? "Included" : "Excluded")
                            }
                        }
                    }
                }

            Text("\(commitment.postingDays.count) day\(commitment.postingDays.count == 1 ? "" : "s") a week, \(commitment.goal) post\(commitment.goal == 1 ? "" : "s") each day")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)

            Spacer()
            PrimaryButton(title: "Continue") { go(to: .permission) }
        }
        .padding(Spacing.extraLarge)
    }

    private var permissionView: some View {
        VStack(spacing: Spacing.extraLarge) {
            stepHeader(.permission)
            Spacer()
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)
                .frame(width: 96, height: 96)
                .background(Theme.surface, in: Circle())
            VStack(spacing: Spacing.medium) {
                Text("Allow app blocking")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text("To lock distracting apps when you miss a posting deadline, POSTLOCK needs Screen Time access.")
                    .font(.title3)
                    .foregroundStyle(Theme.secondaryText)
                    .multilineTextAlignment(.center)
            }
            if let permissionError {
                Text(permissionError).font(.footnote).foregroundStyle(Theme.danger).multilineTextAlignment(.center)
            }
            Spacer()
            PrimaryButton(title: "Allow Screen Time") {
                Task {
                    do {
                        try await session.screenTime.requestAuthorization()
                        go(to: .apps)
                    } catch {
                        permissionError = "Screen Time access wasn't approved. You can enable it in Settings."
                    }
                }
            }
            if permissionError != nil {
                Button("Open Settings") {
                    if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                        openURL(settingsURL)
                    }
                }
            }
            #if targetEnvironment(simulator)
            Button("Continue in Simulator") { go(to: .apps) }
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)
            #endif
        }
        .padding(Spacing.extraLarge)
    }

    private var appSelectionView: some View {
        VStack(alignment: .leading, spacing: Spacing.extraLarge) {
            stepHeader(.apps)
            VStack(alignment: .leading, spacing: Spacing.small) {
                Text("Keep X available")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text("Select only X in the Screen Time picker, not All Apps. When you miss a deadline, every other app locks and X stays open so you can post.")
                    .foregroundStyle(Theme.secondaryText)
            }

            Button { showingPicker = true } label: {
                SurfaceCard {
                    HStack {
                        Image(systemName: "at").foregroundStyle(Theme.accent)
                        VStack(alignment: .leading) {
                            Text("Choose X / Twitter").fontWeight(.bold).foregroundStyle(.white)
                            AllowedAppStatus(token: session.screenTime.allowedAppToken, issue: session.screenTime.allowedAppIssue)
                                .font(.subheadline)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(Theme.secondaryText)
                    }
                }
            }
            .buttonStyle(.plain)

            Text("Apple keeps the selected app private. POSTLOCK stores its anonymous Screen Time token only on this device.")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
            Label("We'll remind you before each deadline so you're never locked out by surprise.", systemImage: "bell.badge")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
            Spacer()
            PrimaryButton(
                title: onboardingFinish == nil ? "Block All Other Apps" : "Continue",
                isDisabled: !session.screenTime.hasValidXException && !isSimulator
            ) {
                if let onboardingFinish {
                    onboardingFinish(commitment)
                    return
                }
                session.activate(commitment)
                if isEditing { dismiss() }
            }
        }
        .padding(Spacing.extraLarge)
    }

    private func frequencyButton(_ goal: Int) -> some View {
        Button {
            commitment = .suggested(goal: goal, timezoneIdentifier: commitment.timezoneIdentifier)
        } label: {
            Text("\(goal)×")
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 48)
                .foregroundStyle(commitment.goal == goal ? .black : .white)
                .background(commitment.goal == goal ? Theme.accent : Theme.secondarySurface, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private func togglePostingDay(_ weekday: Int) {
        if commitment.postingDays.contains(weekday) {
            guard commitment.postingDays.count > 1 else { return }
            commitment.postingDays.remove(weekday)
        } else {
            commitment.postingDays.insert(weekday)
        }
    }

    private func deadlineBinding(_ index: Int) -> Binding<Date> {
        Binding {
            Calendar.current.date(byAdding: .minute, value: commitment.deadlineMinutes[index], to: Calendar.current.startOfDay(for: .now)) ?? .now
        } set: { date in
            let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
            commitment.deadlineMinutes[index] = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
            commitment.deadlineMinutes.sort()
        }
    }

    private func stepHeader(_ current: Step) -> some View {
        HStack {
            Text("\(current.rawValue + 1) OF 4")
                .font(.caption.weight(.black))
                .tracking(1.5)
                .foregroundStyle(Theme.accent)
            Spacer()
            if let previous = Step(rawValue: current.rawValue - 1) {
                Button("Back") { go(to: previous) }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(minHeight: 44)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func go(to next: Step) {
        withAnimation(.easeInOut(duration: 0.25)) { step = next }
    }

    private var isSimulator: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }
}
