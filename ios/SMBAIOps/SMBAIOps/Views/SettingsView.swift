import SwiftUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var auth
    @State private var showingLogoutConfirm = false
    @State private var showingServerConfig = false
    @State private var serverURL = APIClient.shared.baseURL

    var body: some View {
        List {
            Section("Account") {
                if let user = auth.currentUser {
                    HStack {
                        ZStack {
                            Circle()
                                .fill(Color.accentColor.opacity(0.15))
                                .frame(width: 44, height: 44)
                            Text(String(user.name.prefix(1)).uppercased())
                                .font(.headline.bold())
                                .foregroundStyle(Color.accentColor)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name)
                                .font(.body.bold())
                            Text(user.email)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section("Server") {
                HStack {
                    Text("URL")
                    Spacer()
                    Text(APIClient.shared.baseURL)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .onTapGesture {
                    showingServerConfig = true
                }
            }

            Section("App") {
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                LabeledContent("Build", value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1")
            }

            Section {
                Button(role: .destructive) {
                    showingLogoutConfirm = true
                } label: {
                    HStack {
                        Spacer()
                        Text("Sign Out")
                            .fontWeight(.semibold)
                        Spacer()
                    }
                }
            }
        }
        .navigationTitle("Settings")
        .confirmationDialog("Sign out?", isPresented: $showingLogoutConfirm, titleVisibility: .visible) {
            Button("Sign Out", role: .destructive) {
                Task { await auth.logout() }
            }
        }
        .sheet(isPresented: $showingServerConfig) {
            NavigationStack {
                Form {
                    Section("Server URL") {
                        TextField("https://your-server.com", text: $serverURL)
                            .keyboardType(.URL)
                            .autocapitalization(.none)
                    }
                    Section {
                        Text("Point this to your deployed SMB AI Ops server, or use http://localhost:3000 for local development.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .navigationTitle("Server")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showingServerConfig = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            APIClient.shared.baseURL = serverURL
                            showingServerConfig = false
                        }
                    }
                }
            }
            .presentationDetents([.medium])
        }
    }
}
