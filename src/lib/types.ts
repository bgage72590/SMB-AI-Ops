// Core domain types for the SMB AI Ops platform.
//
// We keep these intentionally flat so the store in src/lib/store.ts can
// map them 1:1 onto SQLite rows. Every user-owned row carries a `userId`
// foreign key so everything can be scoped to a single workspace.

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export type PlanTier = "free" | "starter" | "pro";

export interface User {
  id: string;
  email: string;
  name: string;
  /**
   * Per-user inbound address. Incoming SendGrid mail whose envelope
   * recipient matches this value is routed to this user. Mail that matches
   * no user is dropped, never routed to a default account.
   */
  inboundAddress?: string;
  /**
   * Weekly AI spend budget in USD. When the rolling 7-day spend exceeds this
   * the platform falls back to heuristic mode. 0 = unlimited.
   */
  aiWeeklyBudgetUsd: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  subscriptionStatus?: SubscriptionStatus;
  planTier: PlanTier;
  /** ISO timestamp when the free trial expires. null = no trial (paid). */
  trialEndsAt?: string;
  /** Google Calendar OAuth tokens for availability integration. */
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleCalendarEnabled?: boolean;
  /** Gmail OAuth tokens for direct inbox reading. */
  gmailAccessToken?: string;
  gmailRefreshToken?: string;
  gmailConnected?: boolean;
  gmailEmail?: string;
  /** Outlook OAuth tokens for direct inbox reading. */
  outlookAccessToken?: string;
  outlookRefreshToken?: string;
  outlookConnected?: boolean;
  outlookEmail?: string;
  /** Workspace ID for team collaboration (Phase 3.3). */
  workspaceId?: string;
  /** Twilio number assigned to this user (E.164). SMS in and out uses it. */
  smsNumber?: string;
  /** Slack install: inbound messages from this workspace + channel route here. */
  slackTeamId?: string;
  slackChannelId?: string;
  slackChannelName?: string;
  /** Incoming-webhook URL from the Slack install, for outbound notifications. */
  slackWebhookUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  /** Opaque session token (doubles as cookie value). */
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export type EmailCategory =
  | "new_lead"
  | "deal_update"
  | "invoice"
  | "follow_up_needed"
  | "scheduling"
  | "other";

export type EmailPriority = "low" | "normal" | "high" | "urgent";

// Local-service-business job lifecycle. The type name stays `DealStage`
// for continuity with the store/types layer — the user never sees this
// string. UI labels say "Jobs" / "Clients".
//
//   inquiry     — a client reached out, nothing booked yet
//   quoted      — we sent an estimate
//   scheduled   — appointment on the books
//   in_progress — job is actively happening / partially done
//   completed   — job finished (the "won" terminal state)
//   lost        — client declined or ghosted (terminal)
export type DealStage =
  | "inquiry"
  | "quoted"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "lost";

/**
 * Stages that are still "in the pipeline" — i.e. something the owner
 * can still work on. Terminal stages (`completed`, `lost`) live outside
 * this set. Exported so every consumer (store queries, digest stats,
 * dashboard tiles) uses the exact same definition.
 */
export const OPEN_DEAL_STAGES: ReadonlyArray<DealStage> = [
  "inquiry",
  "quoted",
  "scheduled",
  "in_progress",
];

export const TERMINAL_DEAL_STAGES: ReadonlyArray<DealStage> = [
  "completed",
  "lost",
];

/** Mapping for migrating DBs seeded under the old B2B-sales naming. */
export const LEGACY_STAGE_MAP: Record<string, DealStage> = {
  lead: "inquiry",
  qualified: "quoted",
  proposal: "quoted",
  negotiation: "scheduled",
  won: "completed",
  lost: "lost",
};

export interface Contact {
  id: string;
  userId: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  userId: string;
  title: string;
  contactId: string;
  stage: DealStage;
  amount: number; // in whole currency units (e.g. USD)
  currency: string;
  costMaterials: number;
  costLabor: number;
  nextStep?: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Email {
  id: string;
  userId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: string;
  // AI-populated fields
  processed: boolean;
  category?: EmailCategory;
  priority?: EmailPriority;
  summary?: string;
  // Links to other records created/updated from this email
  contactId?: string;
  dealId?: string;
  // If a follow-up draft was created for this email
  followUpId?: string;
}

export type FollowUpChannel = "email" | "sms";

export interface FollowUp {
  id: string;
  userId: string;
  emailId?: string;
  dealId?: string;
  contactId: string;
  subject: string;
  draft: string;
  reason: string;
  status: "draft" | "approved" | "sent" | "dismissed";
  /** Delivery channel. Defaults to "email". SMS requires a phone on the contact. */
  channel: FollowUpChannel;
  createdAt: string;
  scheduledFor?: string;
  /** ISO timestamp when the follow-up was actually dispatched. */
  sentAt?: string;
  /** Message ID returned by the email provider (e.g. SendGrid) or Twilio SID. */
  sentMessageId?: string;
  /** iCalendar (.ics) data when a concrete appointment time was detected. */
  icsData?: string;
}

export type WebhookEvent =
  | "contact.created"
  | "contact.updated"
  | "deal.created"
  | "deal.updated"
  | "deal.stage_changed"
  | "email.received"
  | "email.processed"
  | "followup.created"
  | "followup.sent"
  | "invoice.created"
  | "invoice.status_changed";

export interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: string;
  status?: number;
  response?: string;
  attempts: number;
  lastAttempt?: string;
  createdAt: string;
}

export type SmsDirection = "inbound" | "outbound";

export interface SmsMessage {
  id: string;
  userId: string;
  contactId?: string;
  direction: SmsDirection;
  fromNumber: string;
  toNumber: string;
  body: string;
  twilioSid?: string;
  status: string;
  createdAt: string;
}

export type InvoiceType = "quote" | "invoice";
export type InvoiceStatus = "draft" | "sent" | "accepted" | "declined" | "paid" | "void";

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  userId: string;
  dealId?: string;
  contactId: string;
  type: InvoiceType;
  number: string;
  status: InvoiceStatus;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  validUntil?: string;
  paidAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreShape {
  contacts: Contact[];
  deals: Deal[];
  emails: Email[];
  followUps: FollowUp[];
}
