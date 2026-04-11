// Core domain types for the SMB AI Ops platform.
//
// We keep these intentionally flat so the JSON store in src/lib/store.ts can
// serialize them directly. If this ever graduates to a real database, the
// shapes map cleanly onto SQL tables.

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
