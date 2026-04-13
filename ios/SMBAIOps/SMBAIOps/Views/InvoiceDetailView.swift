import SwiftUI

struct InvoiceDetailView: View {
    @State var invoice: Invoice
    @State private var isUpdating = false

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(invoice.number)
                            .font(.title2.bold())
                        Spacer()
                        StatusBadge(text: invoice.statusLabel, color: statusColor)
                    }
                    Text(invoice.isQuote ? "Quote" : "Invoice")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                .padding(.vertical, 4)
            }

            if !invoice.lineItems.isEmpty {
                Section("Line Items") {
                    ForEach(invoice.lineItems) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.description)
                                    .font(.subheadline)
                                Text("\(Int(item.quantity)) x $\(String(format: "%.2f", item.unitPrice))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("$\(String(format: "%.2f", item.total))")
                                .font(.subheadline.bold())
                        }
                    }
                }
            }

            Section("Totals") {
                LabeledRow(icon: "sum", label: "Subtotal", value: "$\(String(format: "%.2f", invoice.subtotal))")
                if invoice.tax > 0 {
                    LabeledRow(icon: "percent", label: "Tax", value: "$\(String(format: "%.2f", invoice.tax))")
                }
                HStack {
                    Label("Total", systemImage: "dollarsign.circle.fill")
                        .font(.subheadline.bold())
                    Spacer()
                    Text("$\(String(format: "%.2f", invoice.total))")
                        .font(.headline.bold())
                }
            }

            Section("Details") {
                LabeledRow(icon: "calendar", label: "Created", value: invoice.createdAt.formattedDate)
                if let sent = invoice.sentAt {
                    LabeledRow(icon: "paperplane.fill", label: "Sent", value: sent.formattedDate)
                }
                if let paid = invoice.paidAt {
                    LabeledRow(icon: "checkmark.circle.fill", label: "Paid", value: paid.formattedDate)
                }
            }

            if let notes = invoice.notes, !notes.isEmpty {
                Section("Notes") {
                    Text(notes)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            if !availableActions.isEmpty {
                Section("Actions") {
                    ForEach(availableActions, id: \.status) { action in
                        Button {
                            updateStatus(action.status)
                        } label: {
                            HStack {
                                Label(action.label, systemImage: action.icon)
                                Spacer()
                                if isUpdating {
                                    ProgressView()
                                }
                            }
                        }
                        .disabled(isUpdating)
                    }
                }
            }
        }
        .navigationTitle(invoice.isQuote ? "Quote" : "Invoice")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var statusColor: Color {
        switch invoice.status {
        case "draft": .gray
        case "sent": .blue
        case "accepted", "paid": .green
        case "declined", "void": .red
        default: .gray
        }
    }

    private struct ActionItem {
        let label: String
        let status: String
        let icon: String
    }

    private var availableActions: [ActionItem] {
        switch invoice.status {
        case "draft":
            return [ActionItem(label: "Mark as Sent", status: "sent", icon: "paperplane.fill")]
        case "sent":
            if invoice.isQuote {
                return [
                    ActionItem(label: "Mark Accepted", status: "accepted", icon: "checkmark.circle.fill"),
                    ActionItem(label: "Mark Declined", status: "declined", icon: "xmark.circle.fill"),
                ]
            } else {
                return [
                    ActionItem(label: "Mark as Paid", status: "paid", icon: "banknote.fill"),
                    ActionItem(label: "Void", status: "void", icon: "xmark.circle.fill"),
                ]
            }
        case "accepted":
            return [ActionItem(label: "Mark as Paid", status: "paid", icon: "banknote.fill")]
        default:
            return []
        }
    }

    private func updateStatus(_ status: String) {
        isUpdating = true
        Task {
            do {
                let response: InvoicesResponse = try await APIClient.shared.patch("/api/invoices", body: UpdateInvoiceRequest(
                    id: invoice.id,
                    status: status,
                    lineItems: nil,
                    tax: nil
                ))
                if let updated = response.invoices.first(where: { $0.id == invoice.id }) {
                    invoice = updated
                }
            } catch {
                // Could show error
            }
            isUpdating = false
        }
    }
}
