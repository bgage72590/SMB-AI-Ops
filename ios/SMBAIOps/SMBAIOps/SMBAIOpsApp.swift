import SwiftUI

@main
struct SMBAIOpsApp: App {
    @State private var auth = AuthManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isLoading {
                    LaunchScreen()
                } else if auth.isAuthenticated {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            .environment(auth)
            .tint(Color.accentColor)
            .task {
                await auth.checkSession()
            }
        }
    }
}

private struct LaunchScreen: View {
    var body: some View {
        ZStack {
            Color.accentColor.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "bolt.shield.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(.white)
                Text("SMB AI Ops")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                ProgressView()
                    .tint(.white)
            }
        }
    }
}
