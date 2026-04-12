import SwiftUI

struct FollowUpsView: View {
    @State private var followUps: [FollowUp] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var filterStatus: String?

    var filtered: [FollowUp] {
        guard let status = filterStatus else { return followUps }
        return followUps.filter { $0.status == status }
    }

    var body: some View {
        VStack(spacing: 0) {
            statusFilter
            Group {
                if isLoading && followUps.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error, followUps.isEmpty {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await load() } }
                    }
                } else if filtered.isEmpty {
                    ContentUnavailableView(
                        "No follow-ups",
                        systemImage: "arrow.uturn.forward",
                        description: Text("AI-generated follow-ups appear here")
                    )
                } else {
                    List(filtered) { fu in
                        FollowUpRow(followUp: fu, onAction: { await load() })
                    }
                    .listStyle(.plain)
                }
            }
        }
        .navigationTitle("Follow-Ups")
        .refreshable { await load() }
        .task { await load() }
    }

    private var statusFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(label: "All", isSelected: filterStatus == nil) {
                    filterStatus = nil
                }
                ForEach(["draft", "approved", "sent", "dismissed"], id: \.self) { status in
                    let count = followUps.filter { $0.status == status }.count
                    FilterChip(label: "\(status.capitalized) (\(count))", isSelected: filterStatus == status) {
                        filterStatus = filterStatus == status ? nil : status
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(.bar)
    }

    private func load() async {
        isLoading = true
        do {
            let response: FollowUpsResponse = try await APIClient.shared.get("/api/followups")
            followUps = response.followUps
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct FollowUpRow: View {
    let followUp: FollowUp
    let onAction: () async -> Void
    @State private var isExpanded = false
    @State private var isSending = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(followUp.subject)
                        .font(.subheadline.bold())
                        .lineLimit(isExpanded ? nil : 1)
                    if let reason = followUp.reason, !reason.isEmpty {
                        Text(reason)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(isExpanded ? nil : 1)
                    }
                }
                Spacer()
                StatusBadge(text: followUp.statusLabel, color: statusColor)
            }

            if isExpanded {
                Text(followUp.draft)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 8))

                if followUp.status == "draft" {
                    HStack(spacing: 12) {
                        Button {
                            sendFollowUp()
                        } label: {
                            Label("Send", systemImage: "paperplane.fill")
                                .font(.subheadline.bold())
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isSending)

                        Button(role: .destructive) {
                            dismissFollowUp()
                        } label: {
                            Label("Dismiss", systemImage: "xmark")
                                .font(.subheadline)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }

            HStack {
                if let channel = followUp.channel {
                    Label(channel == "sms" ? "SMS" : "Email", systemImage: channel == "sms" ? "message.fill" : "envelope.fill")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                Spacer()
                Text(followUp.createdAt.relativeDate)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.easeInOut(duration: 0.2)) {
                isExpanded.toggle()
            }
        }
    }

    private var statusColor: Color {
        switch followUp.status {
        case "draft": .orange
        case "approved": .blue
        case "sent": .green
        case "dismissed": .gray
        default: .gray
        }
    }

    private func sendFollowUp() {
        isSending = true
        Task {
            do {
                try await APIClient.shared.postNoContent(
                    "/api/followups/send",
                    body: ["id": followUp.id]
                )
                await onAction()
            } catch {
                // Could show error
            }
            isSending = false
        }
    }

    private func dismissFollowUp() {
        Task {
            do {
                let _: FollowUpsResponse = try await APIClient.shared.patch(
                    "/api/followups",
                    body: ["id": followUp.id, "status": "dismissed"]
                )
                await onAction()
            } catch {
                // Could show error
            }
        }
    }
}
