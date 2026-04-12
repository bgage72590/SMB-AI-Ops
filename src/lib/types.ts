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
   * Optional per-user inbound address. When set, incoming Postmark webhooks
   * whose `To` header matches this value are routed to this user. When not
   * set, the inbound webhook falls back to the first user in the database.
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
  createdAt: string;
  scheduledFor?: string;
  /** ISO timestamp when the follow-up was actually dispatched. */
  sentAt?: string;
  /** Message ID returned by the email provider (e.g. Postmark). */
  sentMessageId?: string;
  /** iCalendar (.ics) data when a concrete appointment time was detected. */
  icsData?: string;
}

export interface StoreShape {
  contacts: Contact[];
  deals: Deal[];
  emails: Email[];
  followUps: FollowUp[];
}
