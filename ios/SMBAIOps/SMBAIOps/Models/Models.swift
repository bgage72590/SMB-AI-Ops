import Foundation

// MARK: - Auth

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct SignupRequest: Encodable {
    let name: String
    let email: String
    let password: String
}

struct AuthResponse: Decodable {
    let user: User
}

struct User: Codable, Identifiable, Hashable {
    let id: String
    let email: String
    let name: String
}

// MARK: - Contact

struct Contact: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let name: String
    let email: String
    let company: String?
    let phone: String?
    let notes: String?
    let createdAt: String
    let updatedAt: String?
}

struct ContactsResponse: Decodable {
    let contacts: [Contact]
}

struct CreateContactRequest: Encodable {
    let name: String
    let email: String
    let company: String?
    let phone: String?
    let notes: String?
}

// MARK: - Deal

struct Deal: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let title: String
    let contactId: String?
    let stage: String
    let amount: Double?
    let currency: String?
    let costMaterials: Double?
    let costLabor: Double?
    let nextStep: String?
    let lastActivityAt: String?
    let createdAt: String
    let updatedAt: String?

    var stageLabel: String {
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

    var stageColor: String {
        switch stage {
        case "inquiry": "blue"
        case "quoted": "orange"
        case "scheduled": "purple"
        case "in_progress": "yellow"
        case "completed": "green"
        case "lost": "red"
        default: "gray"
        }
    }

    static let allStages = ["inquiry", "quoted", "scheduled", "in_progress", "completed", "lost"]
}

struct DealsResponse: Decodable {
    let deals: [Deal]
}

struct CreateDealRequest: Encodable {
    let title: String
    let contactId: String?
    let stage: String
    let amount: Double?
}

struct UpdateDealRequest: Encodable {
    let id: String
    let stage: String?
    let amount: Double?
    let nextStep: String?
}

// MARK: - Email

struct Email: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let from: String
    let fromName: String?
    let to: String?
    let subject: String
    let body: String?
    let receivedAt: String
    let processed: Bool?
    let category: String?
    let priority: String?
    let summary: String?
    let contactId: String?
    let dealId: String?
    let followUpId: String?

    var categoryLabel: String {
        switch category {
        case "new_lead": "New Lead"
        case "deal_update": "Deal Update"
        case "invoice": "Invoice"
        case "follow_up_needed": "Follow-up"
        case "scheduling": "Scheduling"
        case "other": "Other"
        default: category?.capitalized ?? "Unprocessed"
        }
    }

    var priorityLabel: String {
        switch priority {
        case "urgent": "Urgent"
        case "high": "High"
        case "normal": "Normal"
        case "low": "Low"
        default: ""
        }
    }
}

struct EmailsResponse: Decodable {
    let emails: [Email]
}

// MARK: - Follow-Up

struct FollowUp: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let emailId: String?
    let dealId: String?
    let contactId: String?
    let subject: String
    let draft: String
    let reason: String?
    let status: String
    let channel: String?
    let createdAt: String
    let scheduledFor: String?
    let sentAt: String?

    var statusLabel: String {
        switch status {
        case "draft": "Draft"
        case "approved": "Approved"
        case "sent": "Sent"
        case "dismissed": "Dismissed"
        default: status.capitalized
        }
    }
}

struct FollowUpsResponse: Decodable {
    let followUps: [FollowUp]
}

// MARK: - Invoice

struct LineItem: Codable, Identifiable, Hashable {
    var id: String
    var description: String
    var quantity: Double
    var unitPrice: Double
    var total: Double

    init(id: String = UUID().uuidString, description: String = "", quantity: Double = 1, unitPrice: Double = 0, total: Double = 0) {
        self.id = id
        self.description = description
        self.quantity = quantity
        self.unitPrice = unitPrice
        self.total = total
    }
}

struct Invoice: Identifiable, Hashable {
    let id: String
    let userId: String
    let dealId: String?
    let contactId: String?
    let type: String
    let number: String
    let status: String
    let lineItems: [LineItem]
    let subtotal: Double
    let tax: Double
    let total: Double
    let notes: String?
    let validUntil: String?
    let paidAt: String?
    let sentAt: String?
    let createdAt: String
    let updatedAt: String?
    let contactName: String?

    var isQuote: Bool { type == "quote" }

    var statusLabel: String {
        switch status {
        case "draft": "Draft"
        case "sent": "Sent"
        case "accepted": "Accepted"
        case "declined": "Declined"
        case "paid": "Paid"
        case "void": "Void"
        default: status.capitalized
        }
    }

    var statusColor: String {
        switch status {
        case "draft": "gray"
        case "sent": "blue"
        case "accepted": "green"
        case "declined": "red"
        case "paid": "green"
        case "void": "red"
        default: "gray"
        }
    }
}

extension Invoice: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, userId, dealId, contactId, type, number, status
        case lineItems, subtotal, tax, total, notes
        case validUntil, paidAt, sentAt, createdAt, updatedAt, contactName
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        userId = try c.decode(String.self, forKey: .userId)
        dealId = try c.decodeIfPresent(String.self, forKey: .dealId)
        contactId = try c.decodeIfPresent(String.self, forKey: .contactId)
        type = try c.decode(String.self, forKey: .type)
        number = try c.decode(String.self, forKey: .number)
        status = try c.decode(String.self, forKey: .status)
        subtotal = try c.decodeIfPresent(Double.self, forKey: .subtotal) ?? 0
        tax = try c.decodeIfPresent(Double.self, forKey: .tax) ?? 0
        total = try c.decodeIfPresent(Double.self, forKey: .total) ?? 0
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        validUntil = try c.decodeIfPresent(String.self, forKey: .validUntil)
        paidAt = try c.decodeIfPresent(String.self, forKey: .paidAt)
        sentAt = try c.decodeIfPresent(String.self, forKey: .sentAt)
        createdAt = try c.decode(String.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        contactName = try c.decodeIfPresent(String.self, forKey: .contactName)

        if let items = try? c.decode([LineItem].self, forKey: .lineItems) {
            lineItems = items
        } else if let str = try? c.decode(String.self, forKey: .lineItems),
                  let data = str.data(using: .utf8),
                  let items = try? JSONDecoder().decode([LineItem].self, from: data) {
            lineItems = items
        } else {
            lineItems = []
        }
    }
}

extension Invoice: Encodable {
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(type, forKey: .type)
        try c.encode(status, forKey: .status)
        try c.encode(lineItems, forKey: .lineItems)
        try c.encodeIfPresent(contactId, forKey: .contactId)
        try c.encodeIfPresent(dealId, forKey: .dealId)
        try c.encodeIfPresent(notes, forKey: .notes)
        try c.encode(tax, forKey: .tax)
    }
}

struct InvoicesResponse: Decodable {
    let invoices: [Invoice]
}

struct CreateInvoiceRequest: Encodable {
    let type: String
    let contactId: String?
    let dealId: String?
    let lineItems: [LineItem]
    let tax: Double
    let notes: String?
}

struct UpdateInvoiceRequest: Encodable {
    let id: String
    let status: String?
    let lineItems: [LineItem]?
    let tax: Double?
}

// MARK: - SMS

struct SmsConversation: Codable, Identifiable, Hashable {
    let contactId: String
    let contactName: String
    let contactPhone: String
    let lastMessage: String?
    let lastAt: String?
    let unread: Int?

    var id: String { contactId }
}

struct SmsConversationsResponse: Decodable {
    let conversations: [SmsConversation]
}

struct SmsMessage: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let contactId: String?
    let direction: String
    let fromNumber: String?
    let toNumber: String?
    let body: String
    let twilioSid: String?
    let status: String?
    let createdAt: String

    var isInbound: Bool { direction == "inbound" }
}

struct SmsMessagesResponse: Decodable {
    let messages: [SmsMessage]
}

struct SendSmsRequest: Encodable {
    let contactId: String
    let body: String
}

// MARK: - Reports

struct StageBreakdown: Codable, Identifiable, Hashable {
    let stage: String
    let count: Int
    let totalValue: Double
    let weightedValue: Double

    var id: String { stage }
}

struct WinRateStats: Codable, Hashable {
    let totalClosed: Int
    let won: Int
    let lost: Int
    let winRate: Double
    let avgDealValue: Double
    let avgDaysToClose: Double
}

struct AtRiskDeal: Codable, Identifiable, Hashable {
    let deal: Deal
    let contactName: String
    let daysSinceActivity: Int
    let reason: String

    var id: String { deal.id }
}

struct PipelineReport: Codable {
    let generatedAt: String
    let stageBreakdown: [StageBreakdown]
    let totalPipeline: Double
    let weightedPipeline: Double
    let winRate: WinRateStats
    let atRisk: [AtRiskDeal]
    let forecastMonthly: Double
}

// MARK: - Search

struct SearchResult: Codable, Identifiable, Hashable {
    let kind: String
    let id: String
    let title: String
    let subtitle: String?
    let href: String
    let score: Double

    var kindIcon: String {
        switch kind {
        case "contact": "person.fill"
        case "deal": "briefcase.fill"
        case "email": "envelope.fill"
        case "followup": "arrow.uturn.forward"
        default: "magnifyingglass"
        }
    }
}

struct SearchResponse: Decodable {
    let results: [SearchResult]
}

// MARK: - Error

struct APIErrorResponse: Decodable {
    let error: String
}

// MARK: - Date Helpers

extension String {
    var relativeDate: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: self) ?? ISO8601DateFormatter().date(from: self) else {
            return self
        }
        let relative = RelativeDateTimeFormatter()
        relative.unitsStyle = .short
        return relative.localizedString(for: date, relativeTo: Date())
    }

    var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: self) ?? ISO8601DateFormatter().date(from: self) else {
            return self
        }
        let display = DateFormatter()
        display.dateStyle = .medium
        display.timeStyle = .short
        return display.string(from: date)
    }
}
