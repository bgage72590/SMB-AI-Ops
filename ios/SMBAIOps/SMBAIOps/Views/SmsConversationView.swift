import SwiftUI

struct SmsConversationView: View {
    let conversation: SmsConversation
    @State private var messages: [SmsMessage] = []
    @State private var isLoading = true
    @State private var newMessage = ""
    @State private var isSending = false

    var body: some View {
        VStack(spacing: 0) {
            messageList
            composeBar
        }
        .navigationTitle(conversation.contactName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding()
            }
            .onChange(of: messages.count) {
                if let last = messages.last {
                    withAnimation {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var composeBar: some View {
        HStack(spacing: 12) {
            TextField("Message...", text: $newMessage, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...4)
                .padding(10)
                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 20))

            Button {
                send()
            } label: {
                if isSending {
                    ProgressView()
                        .frame(width: 32, height: 32)
                } else {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title)
                        .foregroundStyle(newMessage.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray : Color.accentColor)
                }
            }
            .disabled(isSending || newMessage.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    private func load() async {
        isLoading = true
        do {
            let response: SmsMessagesResponse = try await APIClient.shared.get(
                "/api/sms",
                query: ["contactId": conversation.contactId]
            )
            messages = response.messages
        } catch {
            // Could show error
        }
        isLoading = false
    }

    private func send() {
        let text = newMessage.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        isSending = true
        newMessage = ""

        Task {
            do {
                let _: SmsMessagesResponse = try await APIClient.shared.post(
                    "/api/sms",
                    body: SendSmsRequest(contactId: conversation.contactId, body: text)
                )
                await load()
            } catch {
                newMessage = text
            }
            isSending = false
        }
    }
}

private struct MessageBubble: View {
    let message: SmsMessage

    var body: some View {
        HStack {
            if !message.isInbound { Spacer(minLength: 60) }

            VStack(alignment: message.isInbound ? .leading : .trailing, spacing: 4) {
                Text(message.body)
                    .font(.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        message.isInbound
                            ? Color(.systemGray5)
                            : Color.accentColor,
                        in: RoundedRectangle(cornerRadius: 18)
                    )
                    .foregroundStyle(message.isInbound ? Color.primary : Color.white)

                Text(message.createdAt.relativeDate)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            if message.isInbound { Spacer(minLength: 60) }
        }
    }
}
