import SwiftUI

struct LoginView: View {
    @Environment(AuthManager.self) private var auth
    @State private var isSignup = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var showServerConfig = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    header
                    form
                    toggleMode
                }
                .padding(.horizontal, 24)
                .padding(.top, 40)
            }
            .background(Color(.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showServerConfig = true
                    } label: {
                        Image(systemName: "server.rack")
                            .font(.footnote)
                    }
                }
            }
            .sheet(isPresented: $showServerConfig) {
                ServerConfigSheet()
            }
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "bolt.shield.fill")
                .font(.system(size: 44))
                .foregroundStyle(Color.accentColor)
            Text("SMB AI Ops")
                .font(.title.bold())
            Text(isSignup ? "Create your account" : "Sign in to your account")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var form: some View {
        VStack(spacing: 16) {
            if isSignup {
                TextField("Name", text: $name)
                    .textContentType(.name)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(.background, in: RoundedRectangle(cornerRadius: 10))
            }

            TextField("Email", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .textFieldStyle(.plain)
                .padding(12)
                .background(.background, in: RoundedRectangle(cornerRadius: 10))

            SecureField("Password", text: $password)
                .textContentType(isSignup ? .newPassword : .password)
                .textFieldStyle(.plain)
                .padding(12)
                .background(.background, in: RoundedRectangle(cornerRadius: 10))

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                submit()
            } label: {
                Group {
                    if isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text(isSignup ? "Create Account" : "Sign In")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isLoading || email.isEmpty || password.isEmpty || (isSignup && name.isEmpty))
        }
    }

    private var toggleMode: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                isSignup.toggle()
                error = nil
            }
        } label: {
            Text(isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up")
                .font(.subheadline)
        }
    }

    private func submit() {
        isLoading = true
        error = nil
        Task {
            do {
                if isSignup {
                    try await auth.signup(name: name, email: email, password: password)
                } else {
                    try await auth.login(email: email, password: password)
                }
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }
}

private struct ServerConfigSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var url: String = APIClient.shared.baseURL

    var body: some View {
        NavigationStack {
            Form {
                Section("Server URL") {
                    TextField("https://your-server.com", text: $url)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                }
                Section {
                    Text("Point this to your SMB AI Ops server. Use http://localhost:3000 for local development.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Server")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        APIClient.shared.baseURL = url
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
