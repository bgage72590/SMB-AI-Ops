import SwiftUI

struct ContactDetailView: View {
    let contact: Contact

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(contact.name)
                        .font(.title2.bold())
                    if let company = contact.company, !company.isEmpty {
                        Label(company, systemImage: "building.2")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                .padding(.vertical, 4)
            }

            Section("Contact Info") {
                LabeledRow(icon: "envelope.fill", label: "Email", value: contact.email)
                if let phone = contact.phone, !phone.isEmpty {
                    LabeledRow(icon: "phone.fill", label: "Phone", value: phone)
                }
            }

            if let notes = contact.notes, !notes.isEmpty {
                Section("Notes") {
                    Text(notes)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Activity") {
                LabeledRow(icon: "calendar", label: "Created", value: contact.createdAt.formattedDate)
                if let updated = contact.updatedAt {
                    LabeledRow(icon: "clock.arrow.circlepath", label: "Updated", value: updated.formattedDate)
                }
            }

            Section {
                if let phone = contact.phone, !phone.isEmpty {
                    Link(destination: URL(string: "tel:\(phone)")!) {
                        Label("Call", systemImage: "phone.fill")
                    }
                    Link(destination: URL(string: "sms:\(phone)")!) {
                        Label("Text", systemImage: "message.fill")
                    }
                }
                Link(destination: URL(string: "mailto:\(contact.email)")!) {
                    Label("Email", systemImage: "envelope.fill")
                }
            }
        }
        .navigationTitle("Contact")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct LabeledRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack {
            Label(label, systemImage: icon)
                .foregroundStyle(.secondary)
                .font(.subheadline)
            Spacer()
            Text(value)
                .font(.subheadline)
                .multilineTextAlignment(.trailing)
        }
    }
}
