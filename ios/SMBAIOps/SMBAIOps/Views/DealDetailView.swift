import SwiftUI

struct DealDetailView: View {
    @State var deal: Deal
    @State private var isUpdating = false

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(deal.title)
                        .font(.title2.bold())
                    StatusBadge(text: deal.stageLabel, color: stageColor)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                .padding(.vertical, 4)
            }

            Section("Details") {
                if let amount = deal.amount, amount > 0 {
                    LabeledRow(icon: "dollarsign.circle.fill", label: "Value", value: "$\(Int(amount).formatted())")
                }
                LabeledRow(icon: "flag.fill", label: "Stage", value: deal.stageLabel)
                if let next = deal.nextStep, !next.isEmpty {
                    LabeledRow(icon: "arrow.forward.circle.fill", label: "Next Step", value: next)
                }
            }

            if deal.costMaterials ?? 0 > 0 || deal.costLabor ?? 0 > 0 {
                Section("Costs") {
                    if let materials = deal.costMaterials, materials > 0 {
                        LabeledRow(icon: "shippingbox.fill", label: "Materials", value: "$\(Int(materials).formatted())")
                    }
                    if let labor = deal.costLabor, labor > 0 {
                        LabeledRow(icon: "wrench.and.screwdriver.fill", label: "Labor", value: "$\(Int(labor).formatted())")
                    }
                    if let amount = deal.amount, let materials = deal.costMaterials, let labor = deal.costLabor {
                        let profit = amount - materials - labor
                        LabeledRow(icon: "chart.line.uptrend.xyaxis", label: "Profit", value: "$\(Int(profit).formatted())")
                    }
                }
            }

            Section("Timeline") {
                LabeledRow(icon: "calendar", label: "Created", value: deal.createdAt.formattedDate)
                if let activity = deal.lastActivityAt {
                    LabeledRow(icon: "clock.fill", label: "Last Activity", value: activity.relativeDate)
                }
            }

            if deal.stage != "completed" && deal.stage != "lost" {
                Section("Move to") {
                    ForEach(nextStages, id: \.self) { stage in
                        Button {
                            updateStage(stage)
                        } label: {
                            HStack {
                                Text(stageName(stage))
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
        .navigationTitle("Job")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var stageColor: Color {
        switch deal.stage {
        case "inquiry": .blue
        case "quoted": .orange
        case "scheduled": .purple
        case "in_progress": .yellow
        case "completed": .green
        case "lost": .red
        default: .gray
        }
    }

    private var nextStages: [String] {
        let all = Deal.allStages
        guard let idx = all.firstIndex(of: deal.stage) else { return [] }
        var stages = Array(all.suffix(from: idx + 1))
        if !stages.contains("lost") { stages.append("lost") }
        return stages
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

    private func updateStage(_ stage: String) {
        isUpdating = true
        Task {
            do {
                let response: DealsResponse = try await APIClient.shared.patch("/api/deals", body: UpdateDealRequest(
                    id: deal.id,
                    stage: stage,
                    amount: nil,
                    nextStep: nil
                ))
                if let updated = response.deals.first(where: { $0.id == deal.id }) {
                    deal = updated
                }
            } catch {
                // Could show error alert
            }
            isUpdating = false
        }
    }
}
