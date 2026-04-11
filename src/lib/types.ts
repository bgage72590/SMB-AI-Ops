// Core domain types for the SMB AI Ops platform.
//
// We keep these intentionally flat so the store in src/lib/store.ts can
// map them 1:1 onto SQLite rows. Every user-owned row carries a `userId`
// foreign key so everything can be scoped to a single workspace.

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

export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

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
}

export interface StoreShape {
  contacts: Contact[];
  deals: Deal[];
  emails: Email[];
  followUps: FollowUp[];
}
