import SwiftUI

struct SmsListView: View {
    @State private var conversations: [SmsConversation] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && conversations.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, conversations.isEmpty {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await load() } }
                }
            } else if conversations.isEmpty {
                ContentUnavailableView(
                    "No conversations",
                    systemImage: "message",
                    description: Text("SMS conversations will appear here. Requires Twilio configuration.")
                )
            } else {
                List(conversations) { convo in
                    NavigationLink(value: convo) {
                        ConversationRow(conversation: convo)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("SMS")
        .refreshable { await load() }
        .task { await load() }
        .navigationDestination(for: SmsConversation.self) { convo in
            SmsConversationView(conversation: convo)
        }
    }

    private func load() async {
        isLoading = true
        do {
            let response: SmsConversationsResponse = try await APIClient.shared.get("/api/sms")
            conversations = response.conversations
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct ConversationRow: View {
    let conversation: SmsConversation

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(conversation.contactName)
                    .font(.body.bold())
                Spacer()
                if let lastAt = conversation.lastAt {
                    Text(lastAt.relativeDate)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            if let msg = conversation.lastMessage, !msg.isEmpty {
                Text(msg)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Text(conversation.contactPhone)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}
