import SwiftUI

@main
struct PostlockApp: App {
    @State private var session = AppSession.makeLive()
    @State private var virality = ViralityStore.makeLive()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(virality)
                .preferredColorScheme(.dark)
                .scrollIndicators(.hidden)
                .onChange(of: scenePhase, initial: true) { _, phase in
                    if phase == .active { Task { await session.appDidBecomeActive() } }
                }
        }
    }
}
