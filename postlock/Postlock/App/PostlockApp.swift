import SwiftUI

@main
struct PostlockApp: App {
    @State private var session = AppSession.makeLive()
    @State private var virality = ViralityStore.makeLive()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(virality)
                .preferredColorScheme(.dark)
        }
    }
}
