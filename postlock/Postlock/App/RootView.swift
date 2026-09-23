import SwiftUI

struct RootView: View {
    @Environment(AppSession.self) private var session

    var body: some View {
        Group {
            if session.hasPostingProfile {
                if session.hasCommitment {
                    MainTabView()
                } else {
                    NavigationStack { ScheduleSetupView() }
                }
            } else {
                NavigationStack {
                    UsernameSetupView(mode: .onboarding)
                }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: session.hasPostingProfile)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            TodayView()
            .tabItem { Label("Today", systemImage: "sun.max") }

            PlaceholderView(
                title: "History",
                message: "Your posting history will appear here.",
                icon: "chart.bar"
            )
            .tabItem { Label("History", systemImage: "clock.arrow.circlepath") }

            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .tint(Theme.accent)
    }
}

struct PlaceholderView: View {
    let title: String
    let message: String
    let icon: String

    var body: some View {
        NavigationStack {
            ContentUnavailableView(title, systemImage: icon, description: Text(message))
                .navigationTitle(title)
        }
    }
}
