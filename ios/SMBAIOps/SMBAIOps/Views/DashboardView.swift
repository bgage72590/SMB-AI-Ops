import SwiftUI

struct DashboardView: View {
    @Environment(AuthManager.self) private var auth
    @State private var report: PipelineReport?
    @State private var recentEmails: [Email] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if let error {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await loadData() } }
                    }
                } else {
                    VStack(spacing: 20) {
                        greeting
                        if let report {
                            pipelineCards(report)
                            winRateCard(report.winRate)
                            if !report.atRisk.isEmpty {
                                atRiskSection(report.atRisk)
                            }
                        }
                        if !recentEmails.isEmpty {
                            recentEmailsSection
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Dashboard")
            .refreshable { await loadData() }
            .task { await loadData() }
        }
    }

    private var greeting: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Welcome back, \(auth.currentUser?.name.components(separatedBy: " ").first ?? "")!")
                    .font(.title3.bold())
                Text("Here's your business overview")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    private func pipelineCards(_ report: PipelineReport) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(title: "Pipeline", value: "$\(Int(report.totalPipeline).formatted())", icon: "chart.bar.fill", color: .blue)
            StatCard(title: "Weighted", value: "$\(Int(report.weightedPipeline).formatted())", icon: "scale.3d", color: .purple)
            StatCard(title: "Forecast/mo", value: "$\(Int(report.forecastMonthly).formatted())", icon: "chart.line.uptrend.xyaxis", color: .green)
            StatCard(title: "At Risk", value: "\(report.atRisk.count)", icon: "exclamationmark.triangle.fill", color: report.atRisk.isEmpty ? .gray : .orange)
        }
    }

    private func winRateCard(_ stats: WinRateStats) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Win Rate", systemImage: "trophy.fill")
                .font(.headline)

            HStack(spacing: 24) {
                VStack {
                    Text("\(Int(stats.winRate * 100))%")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundStyle(.green)
                    Text("Win rate")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Divider().frame(height: 50)

                VStack(alignment: .leading, spacing: 4) {
                    Label("\(stats.won) won", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Label("\(stats.lost) lost", systemImage: "xmark.circle.fill")
                        .foregroundStyle(.red)
                    Text("Avg $\(Int(stats.avgDealValue).formatted())")
                        .foregroundStyle(.secondary)
                }
                .font(.subheadline)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }

    private func atRiskSection(_ deals: [AtRiskDeal]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("At Risk", systemImage: "exclamationmark.triangle.fill")
                .font(.headline)
                .foregroundStyle(.orange)

            ForEach(deals) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.deal.title)
                            .font(.subheadline.bold())
                        Text(item.contactName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("\(item.daysSinceActivity)d ago")
                        .font(.caption.bold())
                        .foregroundStyle(.orange)
                }
                .padding(12)
                .background(.background, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private var recentEmailsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Recent Emails", systemImage: "envelope.fill")
                .font(.headline)

            ForEach(recentEmails.prefix(5)) { email in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(email.fromName ?? email.from)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                        Text(email.subject)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    Text(email.receivedAt.relativeDate)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .background(.background, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private func loadData() async {
        isLoading = report == nil
        error = nil
        do {
            async let reportReq: PipelineReport = APIClient.shared.get("/api/reports")
            async let emailsReq: EmailsResponse = APIClient.shared.get("/api/inbox")
            let (r, e) = try await (reportReq, emailsReq)
            report = r
            recentEmails = e.emails
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
            Text(value)
                .font(.title2.bold())
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.background, in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }
}
