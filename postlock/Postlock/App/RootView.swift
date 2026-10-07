import SwiftUI

struct RootView: View {
    @Environment(AppSession.self) private var session
    @State private var purchases = PurchasesService()
    @AppStorage("didCompleteValueOnboarding") private var didCompleteValueOnboarding = false
    /// The plan built during onboarding, held until the user subscribes.
    @AppStorage("pendingOnboardingCommitment") private var pendingCommitmentData = Data()

    private var pendingCommitment: PostingCommitment? {
        try? JSONDecoder().decode(PostingCommitment.self, from: pendingCommitmentData)
    }

    var body: some View {
        Group {
            if Self.showsPaywallScenario {
                PaywallView(plan: .suggested(goal: 3))
            } else if session.hasPostingProfile {
                if session.hasCommitment {
                    MainTabView()
                } else if let pendingCommitment, purchases.isPro {
                    Theme.background.ignoresSafeArea()
                        .task {
                            session.activate(pendingCommitment)
                            pendingCommitmentData = Data()
                        }
                } else if purchases.isPro {
                    NavigationStack { ScheduleSetupView() }
                } else if !didCompleteValueOnboarding {
                    ValueOnboardingView {
                        didCompleteValueOnboarding = true
                    }
                } else if let pendingCommitment {
                    PaywallView(plan: pendingCommitment)
                } else {
                    NavigationStack {
                        ScheduleSetupView { commitment in
                            pendingCommitmentData = (try? JSONEncoder().encode(commitment)) ?? Data()
                        }
                    }
                }
            } else {
                NavigationStack {
                    UsernameSetupView(mode: .onboarding)
                }
            }
        }
        .environment(purchases)
        .task { purchases.configure() }
        .animation(.easeInOut(duration: 0.3), value: session.hasPostingProfile)
        .animation(.easeInOut(duration: 0.3), value: purchases.isPro)
        .animation(.easeInOut(duration: 0.3), value: pendingCommitmentData)
    }

    /// Opens straight to the paywall, for App Review purchase screenshots.
    private static var showsPaywallScenario: Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["POSTLOCK_UI_TEST_SCENARIO"] == "paywall"
        #else
        false
        #endif
    }
}

struct MainTabView: View {
    /// Debug builds can open on a given tab via POSTLOCK_TAB, for screenshots.
    private static var initialTab: Int {
        #if DEBUG
        Int(ProcessInfo.processInfo.environment["POSTLOCK_TAB"] ?? "") ?? 0
        #else
        0
        #endif
    }

    @Environment(AppSession.self) private var session
    @State private var selected = Self.initialTab

    var body: some View {
        TabView(selection: $selected) {
            TodayView()
                .tabItem { tabIcon("TabHome", label: "Home") }
                .tag(0)

            HistoryView()
                .tabItem { tabIcon("TabAnalytics", label: "Analytics") }
                .tag(1)

            LeaderboardView()
                .tabItem { tabIcon("TabLeaderboard", label: "Leaderboard") }
                .tag(2)

            NavigationStack { SettingsView() }
                .tabItem { tabIcon("TabSettings", label: "Settings") }
                .tag(3)
        }
        .tint(Theme.accent)
        .onChange(of: session.notifications.openTodayRequests) { selected = 0 }
    }

    private func tabIcon(_ name: String, label: String) -> some View {
        let image: Image
        if let bitmap = UIImage(named: name)?.cgImage {
            let icon = UIImage(cgImage: bitmap, scale: CGFloat(bitmap.width) / 32, orientation: .up)
            image = Image(uiImage: icon.withRenderingMode(.alwaysOriginal))
        } else {
            image = Image(systemName: "circle")
        }
        return image.accessibilityLabel(label)
    }
}
