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
    private var failedLoginAttempts = 0
    private var lastFailedLogin: Date?
    private let maxAttempts = 5
    private let lockoutDuration: TimeInterval = 60

    init() {
        if let data = UserDefaults.standard.data(forKey: userKey),
           let user = try? JSONDecoder().decode(User.self, from: data) {
            currentUser = user
        }
    }

    func checkSession() async {
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

    func login(email: String, password: String) async throws {
        try checkBruteForce()
        api.clearCookies()
        do {
            let response: AuthResponse = try await api.post("/api/auth/login", body: LoginRequest(email: email, password: password))
            failedLoginAttempts = 0
            lastFailedLogin = nil
            currentUser = response.user
            cacheUser(response.user)
        } catch {
            failedLoginAttempts += 1
            lastFailedLogin = Date()
            throw error
        }
    }

    func signup(name: String, email: String, password: String) async throws {
        try checkBruteForce()
        api.clearCookies()
        do {
            let response: AuthResponse = try await api.post("/api/auth/signup", body: SignupRequest(name: name, email: email, password: password))
            failedLoginAttempts = 0
            lastFailedLogin = nil
            currentUser = response.user
            cacheUser(response.user)
        } catch {
            failedLoginAttempts += 1
            lastFailedLogin = Date()
            throw error
        }
    }

    private func checkBruteForce() throws {
        if failedLoginAttempts >= maxAttempts,
           let lastFailed = lastFailedLogin,
           Date().timeIntervalSince(lastFailed) < lockoutDuration {
            let remaining = Int(lockoutDuration - Date().timeIntervalSince(lastFailed))
            throw APIError.httpError(429, "Too many attempts. Try again in \(remaining)s.")
        }
        if let lastFailed = lastFailedLogin,
           Date().timeIntervalSince(lastFailed) >= lockoutDuration {
            failedLoginAttempts = 0
            lastFailedLogin = nil
        }
    }

    func logout() async {
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
