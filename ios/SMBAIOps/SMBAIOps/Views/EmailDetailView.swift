import SwiftUI

struct EmailDetailView: View {
    let email: Email

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerSection
                if let summary = email.summary, !summary.isEmpty {
                    aiSummarySection(summary)
                }
                metadataSection
                bodySection
            }
            .padding()
        }
        .navigationTitle("Email")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(email.subject)
                .font(.title3.bold())

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(email.fromName ?? email.from)
                        .font(.subheadline.bold())
                    Text(email.from)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(email.receivedAt.formattedDate)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private func aiSummarySection(_ summary: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("AI Summary", systemImage: "sparkles")
                .font(.caption.bold())
                .foregroundStyle(.purple)

            Text(summary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private var metadataSection: some View {
        HStack(spacing: 12) {
            if let cat = email.category {
                StatusBadge(text: email.categoryLabel, color: categoryColor(cat))
            }
            if let priority = email.priority, !priority.isEmpty {
                StatusBadge(text: email.priorityLabel, color: priority == "urgent" || priority == "high" ? .red : .gray)
            }
        }
    }

    private var bodySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()
            if let body = email.body, !body.isEmpty {
                Text(body)
                    .font(.body)
                    .textSelection(.enabled)
            } else {
                Text("No message body")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
            }
        }
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
