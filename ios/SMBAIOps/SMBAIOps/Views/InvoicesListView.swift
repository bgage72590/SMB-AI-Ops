import SwiftUI

struct InvoicesListView: View {
    var filterType: String? = nil

    @State private var invoices: [Invoice] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var activeTab: String = "quote"

    private var displayType: String { filterType ?? activeTab }

    var filtered: [Invoice] {
        invoices.filter { $0.type == displayType }
    }

    var body: some View {
        VStack(spacing: 0) {
            if filterType == nil {
                Picker("Type", selection: $activeTab) {
                    Text("Quotes").tag("quote")
                    Text("Invoices").tag("invoice")
                }
                .pickerStyle(.segmented)
                .padding()
            }

            Group {
                if isLoading && invoices.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error, invoices.isEmpty {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await load() } }
                    }
                } else if filtered.isEmpty {
                    ContentUnavailableView(
                        "No \(displayType == "quote" ? "quotes" : "invoices")",
                        systemImage: "doc.text",
                        description: Text("Create one from a job detail page")
                    )
                } else {
                    List(filtered) { invoice in
                        NavigationLink(value: invoice) {
                            InvoiceRow(invoice: invoice)
                        }
                    }
                    .listStyle(.plain)
                }
            }
        }
        .navigationTitle(filterType == "invoice" ? "Invoices" : filterType == "quote" ? "Quotes" : "Quotes & Invoices")
        .refreshable { await load() }
        .task { await load() }
        .navigationDestination(for: Invoice.self) { invoice in
            InvoiceDetailView(invoice: invoice)
        }
    }

    private func load() async {
        isLoading = true
        do {
            let response: InvoicesResponse = try await APIClient.shared.get("/api/invoices")
            invoices = response.invoices
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct InvoiceRow: View {
    let invoice: Invoice

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(invoice.number)
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Text("$\(String(format: "%.2f", invoice.total))")
                    .font(.subheadline.bold())
            }
            HStack {
                StatusBadge(text: invoice.statusLabel, color: invoiceStatusColor(invoice.status))
                if let name = invoice.contactName, !name.isEmpty {
                    Text(name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(invoice.createdAt.relativeDate)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }

    private func invoiceStatusColor(_ status: String) -> Color {
        switch status {
        case "draft": .gray
        case "sent": .blue
        case "accepted", "paid": .green
        case "declined", "void": .red
        default: .gray
        }
    }
}
