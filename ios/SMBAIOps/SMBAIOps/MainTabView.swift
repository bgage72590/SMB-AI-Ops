import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "house.fill")
                }
                .tag(0)

            InboxView()
                .tabItem {
                    Label("Inbox", systemImage: "envelope.fill")
                }
                .tag(1)

            DealsListView()
                .tabItem {
                    Label("Jobs", systemImage: "briefcase.fill")
                }
                .tag(2)

            ContactsListView()
                .tabItem {
                    Label("Contacts", systemImage: "person.2.fill")
                }
                .tag(3)

            MoreView()
                .tabItem {
                    Label("More", systemImage: "ellipsis")
                }
                .tag(4)
        }
    }
}

private struct MoreView: View {
    var body: some View {
        NavigationStack {
            List {
                NavigationLink {
                    InvoicesListView(filterType: "quote")
                } label: {
                    Label("Quotes", systemImage: "doc.text")
                }

                NavigationLink {
                    InvoicesListView(filterType: "invoice")
                } label: {
                    Label("Invoices", systemImage: "dollarsign.circle")
                }

                NavigationLink {
                    SmsListView()
                } label: {
                    Label("SMS", systemImage: "message.fill")
                }

                NavigationLink {
                    FollowUpsView()
                } label: {
                    Label("Follow-Ups", systemImage: "arrow.uturn.forward")
                }

                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Settings", systemImage: "gearshape.fill")
                }
            }
            .navigationTitle("More")
        }
    }
}
