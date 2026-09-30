import SwiftUI

struct RootView: View {
    @Environment(AppSession.self) private var session
    @State private var purchases = PurchasesService()

    var body: some View {
        Group {
            if session.hasPostingProfile {
                if session.hasCommitment {
                    MainTabView()
                } else if purchases.isPro {
                    NavigationStack { ScheduleSetupView() }
                } else {
                    PaywallView()
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
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            TodayView()
            .tabItem { Label("Today", systemImage: "sun.max") }

            HistoryView()
                .tabItem { Label("History", systemImage: "clock.arrow.circlepath") }

            LeaderboardView()
                .tabItem { Label("Leaderboard", systemImage: "trophy") }

            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .tint(Theme.accent)
    }
}
