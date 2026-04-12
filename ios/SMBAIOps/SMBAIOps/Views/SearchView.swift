import SwiftUI

struct SearchView: View {
    @State private var query = ""
    @State private var results: [SearchResult] = []
    @State private var isSearching = false

    var body: some View {
        NavigationStack {
            Group {
                if results.isEmpty && !query.isEmpty && !isSearching {
                    ContentUnavailableView.search(text: query)
                } else if results.isEmpty {
                    ContentUnavailableView(
                        "Search",
                        systemImage: "magnifyingglass",
                        description: Text("Search contacts, jobs, emails, and follow-ups")
                    )
                } else {
                    List {
                        ForEach(groupedResults.keys.sorted(), id: \.self) { kind in
                            Section(kindLabel(kind)) {
                                ForEach(groupedResults[kind] ?? []) { result in
                                    HStack(spacing: 12) {
                                        Image(systemName: result.kindIcon)
                                            .foregroundStyle(kindColor(result.kind))
                                            .frame(width: 24)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(result.title)
                                                .font(.subheadline.bold())
                                                .lineLimit(1)
                                            if let subtitle = result.subtitle, !subtitle.isEmpty {
                                                Text(subtitle)
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                                    .lineLimit(1)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Search")
            .searchable(text: $query, prompt: "Contacts, jobs, emails...")
            .onChange(of: query) {
                search()
            }
        }
    }

    private var groupedResults: [String: [SearchResult]] {
        Dictionary(grouping: results, by: \.kind)
    }

    private func kindLabel(_ kind: String) -> String {
        switch kind {
        case "contact": "Contacts"
        case "deal": "Jobs"
        case "email": "Emails"
        case "followup": "Follow-Ups"
        default: kind.capitalized
        }
    }

    private func kindColor(_ kind: String) -> Color {
        switch kind {
        case "contact": .blue
        case "deal": .green
        case "email": .orange
        case "followup": .purple
        default: .gray
        }
    }

    private func search() {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else {
            results = []
            return
        }
        isSearching = true
        Task {
            do {
                let response: SearchResponse = try await APIClient.shared.get(
                    "/api/search",
                    query: ["q": q]
                )
                if query.trimmingCharacters(in: .whitespaces) == q {
                    results = response.results
                }
            } catch {
                // Silently fail for search
            }
            isSearching = false
        }
    }
}
