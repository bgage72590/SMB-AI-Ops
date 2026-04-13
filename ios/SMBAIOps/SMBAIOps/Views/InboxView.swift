import SwiftUI

struct InboxView: View {
    @State private var emails: [Email] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var searchText = ""
    @State private var filterCategory: String?

    var filtered: [Email] {
        var result = emails
        if let cat = filterCategory {
            result = result.filter { $0.category == cat }
        }
        if !searchText.isEmpty {
            let q = searchText.lowercased()
            result = result.filter {
                $0.subject.lowercased().contains(q) ||
                $0.from.lowercased().contains(q) ||
                ($0.fromName?.lowercased().contains(q) ?? false)
            }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                categoryFilter
                Group {
                    if isLoading && emails.isEmpty {
                        ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let error, emails.isEmpty {
                        ContentUnavailableView {
                            Label("Error", systemImage: "exclamationmark.triangle")
                        } description: {
                            Text(error)
                        } actions: {
                            Button("Retry") { Task { await load() } }
                        }
                    } else if filtered.isEmpty {
                        ContentUnavailableView("No emails", systemImage: "envelope", description: Text("Emails will appear here once received"))
                    } else {
                        List(filtered) { email in
                            NavigationLink(value: email) {
                                EmailRow(email: email)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
            }
            .navigationTitle("Inbox")
            .searchable(text: $searchText, prompt: "Search emails")
            .refreshable { await load() }
            .task { await load() }
            .navigationDestination(for: Email.self) { email in
                EmailDetailView(email: email)
            }
        }
    }

    private var categoryFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(label: "All", isSelected: filterCategory == nil) {
                    filterCategory = nil
                }
                ForEach(["new_lead", "scheduling", "deal_update", "follow_up_needed"], id: \.self) { cat in
                    FilterChip(label: categoryName(cat), isSelected: filterCategory == cat) {
                        filterCategory = filterCategory == cat ? nil : cat
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(.bar)
    }

    private func categoryName(_ cat: String) -> String {
        switch cat {
        case "new_lead": "Leads"
        case "scheduling": "Scheduling"
        case "deal_update": "Updates"
        case "follow_up_needed": "Follow-up"
        default: cat.capitalized
        }
    }

    private func load() async {
        isLoading = true
        do {
            let response: EmailsResponse = try await APIClient.shared.get("/api/inbox")
            emails = response.emails
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct EmailRow: View {
    let email: Email

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(email.fromName ?? email.from)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Spacer()
                Text(email.receivedAt.relativeDate)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            Text(email.subject)
                .font(.subheadline)
                .lineLimit(1)
            HStack(spacing: 6) {
                if let cat = email.category {
                    StatusBadge(text: email.categoryLabel, color: categoryColor(cat))
                }
                if email.priority == "urgent" || email.priority == "high" {
                    StatusBadge(text: email.priorityLabel, color: .red)
                }
                if let summary = email.summary, !summary.isEmpty {
                    Text(summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func categoryColor(_ cat: String) -> Color {
        switch cat {
        case "new_lead": .green
        case "scheduling": .purple
        case "deal_update": .blue
        case "follow_up_needed": .orange
        case "invoice": .cyan
        default: .gray
        }
    }
}
