import Foundation
import SwiftUI

@MainActor
@Observable
final class AuthManager {
    var currentUser: User?
    var isAuthenticated: Bool { currentUser != nil }
    var isLoading = true

    private let api = APIClient.shared
    private let userKey = "cached_user"

    init() {
        if let data = UserDefaults.standard.data(forKey: userKey),
           let user = try? JSONDecoder().decode(User.self, from: data) {
            currentUser = user
        }
    }

    funccheckSession() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: ContactsResponse = try await api.get("/api/contacts", query: ["limit": "1"])
            _ = response
        } catch let error as APIError where error.isAuthError {
            currentUser = nil
            clearCache()
        } catch {
            // Network error — keep cached user for offline experience
        }
    }

    funclogin(email: String, password: String) async throws {
        let response: AuthResponse = try await api.post("/api/auth/login", body: LoginRequest(email: email, password: password))
        currentUser = response.user
        cacheUser(response.user)
    }

    funcsignup(name: String, email: String, password: String) async throws {
        let response: AuthResponse = try await api.post("/api/auth/signup", body: SignupRequest(name: name, email: email, password: password))
        currentUser = response.user
        cacheUser(response.user)
    }

    funclogout() async {
        try? await api.postNoContent("/api/auth/logout", body: EmptyBody())
        api.clearCookies()
        currentUser = nil
        clearCache()
    }

    private func cacheUser(_ user: User) {
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: userKey)
        }
    }

    private func clearCache() {
        UserDefaults.standard.removeObject(forKey: userKey)
    }
}

private struct EmptyBody: Encodable {}
