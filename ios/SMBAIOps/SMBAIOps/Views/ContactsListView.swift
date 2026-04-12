import SwiftUI

struct ContactsListView: View {
    @State private var contacts: [Contact] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var searchText = ""
    @State private var showingAdd = false

    var filtered: [Contact] {
        guard !searchText.isEmpty else { return contacts }
        let q = searchText.lowercased()
        return contacts.filter {
            $0.name.lowercased().contains(q) ||
            $0.email.lowercased().contains(q) ||
            ($0.company?.lowercased().contains(q) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && contacts.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error, contacts.isEmpty {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await load() } }
                    }
                } else if filtered.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                } else {
                    List(filtered) { contact in
                        NavigationLink(value: contact) {
                            ContactRow(contact: contact)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Contacts")
            .searchable(text: $searchText, prompt: "Search contacts")
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
                AddContactSheet { await load() }
            }
            .navigationDestination(for: Contact.self) { contact in
                ContactDetailView(contact: contact)
            }
        }
    }

    private func load() async {
        isLoading = true
        do {
            let response: ContactsResponse = try await APIClient.shared.get("/api/contacts")
            contacts = response.contacts
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct ContactRow: View {
    let contact: Contact

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(contact.name)
                .font(.body.bold())
            if let company = contact.company, !company.isEmpty {
                Text(company)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(contact.email)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

private struct AddContactSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var company = ""
    @State private var phone = ""
    @State private var isSaving = false
    @State private var error: String?
    let onSaved: () async -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Required") {
                    TextField("Name", text: $name)
                        .textContentType(.name)
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                }
                Section("Optional") {
                    TextField("Company", text: $company)
                        .textContentType(.organizationName)
                    TextField("Phone", text: $phone)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                }
                if let error {
                    Section {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }
                }
            }
            .navigationTitle("New Contact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isSaving || name.isEmpty || email.isEmpty)
                }
            }
        }
    }

    private func save() {
        isSaving = true
        Task {
            do {
                let _: ContactsResponse = try await APIClient.shared.post("/api/contacts", body: CreateContactRequest(
                    name: name,
                    email: email,
                    company: company.isEmpty ? nil : company,
                    phone: phone.isEmpty ? nil : phone,
                    notes: nil
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
