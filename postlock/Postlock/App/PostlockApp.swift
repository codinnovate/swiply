import SwiftUI

@main
struct PostlockApp: App {
    @State private var session = AppSession.makeLive()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .preferredColorScheme(.dark)
        }
    }
}
