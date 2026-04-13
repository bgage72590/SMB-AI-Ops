import SwiftUI

struct DealsListView: View {
    @State private var deals: [Deal] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var selectedStage: String?
    @State private var showingAdd = false

    var filtered: [Deal] {
        guard let stage = selectedStage else { return deals }
        return deals.filter { $0.stage == stage }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                stageFilter
                Group {
                    if isLoading && deals.isEmpty {
                        ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let error, deals.isEmpty {
                        ContentUnavailableView {
                            Label("Error", systemImage: "exclamationmark.triangle")
                        } description: {
                            Text(error)
                        } actions: {
                            Button("Retry") { Task { await load() } }
                        }
                    } else if filtered.isEmpty {
                        ContentUnavailableView("No jobs", systemImage: "briefcase", description: Text(selectedStage != nil ? "No jobs in this stage" : "Create your first job"))
                    } else {
                        List(filtered) { deal in
                            NavigationLink(value: deal) {
                                DealRow(deal: deal)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
            }
            .navigationTitle("Jobs")
            .refreshable { await load() }
            .task { await load() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAdd = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAdd) {
                AddDealSheet { await load() }
            }
            .navigationDestination(for: Deal.self) { deal in
                DealDetailView(deal: deal)
            }
        }
    }

    private var stageFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(label: "All", isSelected: selectedStage == nil) {
                    selectedStage = nil
                }
                ForEach(Deal.allStages, id: \.self) { stage in
                    let count = deals.filter { $0.stage == stage }.count
                    FilterChip(
                        label: "\(stageName(stage)) (\(count))",
                        isSelected: selectedStage == stage
                    ) {
                        selectedStage = selectedStage == stage ? nil : stage
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(.bar)
    }

    private func stageName(_ stage: String) -> String {
        switch stage {
        case "inquiry": "Inquiry"
        case "quoted": "Quoted"
        case "scheduled": "Scheduled"
        case "in_progress": "In Progress"
        case "completed": "Completed"
        case "lost": "Lost"
        default: stage.capitalized
        }
    }

    private func load() async {
        isLoading = true
        do {
            let response: DealsResponse = try await APIClient.shared.get("/api/deals")
            deals = response.deals
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color(.systemGray5), in: Capsule())
                .foregroundStyle(isSelected ? .white : .primary)
        }
    }
}

private struct DealRow: View {
    let deal: Deal

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(deal.title)
                    .font(.body.bold())
                    .lineLimit(1)
                Spacer()
                if let amount = deal.amount, amount > 0 {
                    Text("$\(Int(amount).formatted())")
                        .font(.subheadline.bold())
                        .foregroundStyle(.green)
                }
            }
            HStack {
                StatusBadge(text: deal.stageLabel, color: stageColor(deal.stage))
                Spacer()
                if let next = deal.nextStep, !next.isEmpty {
                    Text(next)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func stageColor(_ stage: String) -> Color {
        switch stage {
        case "inquiry": .blue
        case "quoted": .orange
        case "scheduled": .purple
        case "in_progress": .yellow
        case "completed": .green
        case "lost": .red
        default: .gray
        }
    }
}

private struct AddDealSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var stage = "inquiry"
    @State private var amount = ""
    @State private var isSaving = false
    @State private var error: String?
    let onSaved: () async -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Job title", text: $title)
                    Picker("Stage", selection: $stage) {
                        ForEach(Deal.allStages, id: \.self) { s in
                            Text(dealStageName(s)).tag(s)
                        }
                    }
                    TextField("Amount ($)", text: $amount)
                        .keyboardType(.decimalPad)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                }
            }
            .navigationTitle("New Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isSaving || title.isEmpty)
                }
            }
        }
    }

    private func dealStageName(_ s: String) -> String {
        switch s {
        case "inquiry": "Inquiry"
        case "quoted": "Quoted"
        case "scheduled": "Scheduled"
        case "in_progress": "In Progress"
        case "completed": "Completed"
        case "lost": "Lost"
        default: s.capitalized
        }
    }

    private func save() {
        isSaving = true
        Task {
            do {
                let _: DealsResponse = try await APIClient.shared.post("/api/deals", body: CreateDealRequest(
                    title: title,
                    contactId: nil,
                    stage: stage,
                    amount: Double(amount)
                ))
                await onSaved()
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isSaving = false
        }
    }
}
