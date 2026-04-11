import {
  createDeal,
  createFollowUp,
  findContactByEmail,
  findOpenDealForContact,
  getContact,
  getDeal,
  getEmail,
  listEmails,
  updateDeal,
  updateEmail,
  upsertContact,
} from "./store";
import { draftFollowUp, triageEmailSafe } from "./ai";
import type { Email } from "./types";

// The "brain" that turns a raw email into CRM side-effects. Every route that
// wants to run the pipeline (manual trigger, webhook, cron) goes through here.

export interface PipelineResult {
  emailId: string;
  category: string;
  priority: string;
  summary: string;
  contactId?: string;
  dealId?: string;
  followUpId?: string;
}

export async function processEmail(email: Email): Promise<PipelineResult> {
  const triage = await triageEmailSafe(email);

  // Resolve or create contact.
  let contactId: string | undefined;
  if (triage.suggested_contact) {
    const c = upsertContact({
      name: triage.suggested_contact.name,
      email: triage.suggested_contact.email,
      company: triage.suggested_contact.company,
    });
    contactId = c.id;
  } else {
    const existing = findContactByEmail(email.from);
    if (existing) {
      contactId = existing.id;
    } else if (triage.category !== "other" && triage.category !== "invoice") {
      const c = upsertContact({
        name: email.fromName || email.from,
        email: email.from,
      });
      contactId = c.id;
    }
  }

  // Resolve or create / update deal.
  let dealId: string | undefined;
  if (contactId && triage.suggested_deal) {
    const open = findOpenDealForContact(contactId);
    if (open) {
      const updated = updateDeal(open.id, {
        stage: triage.suggested_deal.stage,
        amount: triage.suggested_deal.amount ?? open.amount,
        nextStep: triage.suggested_deal.next_step ?? open.nextStep,
        title: triage.suggested_deal.title || open.title,
      });
      dealId = updated?.id;
    } else {
      const created = createDeal({
        title: triage.suggested_deal.title,
        contactId,
        stage: triage.suggested_deal.stage,
        amount: triage.suggested_deal.amount,
        nextStep: triage.suggested_deal.next_step,
      });
      dealId = created.id;
    }
  } else if (contactId) {
    // Even without an explicit deal suggestion, if this is a deal_update,
    // bump lastActivityAt on any open deal.
    const open = findOpenDealForContact(contactId);
    if (open && triage.category === "deal_update") {
      updateDeal(open.id, {});
      dealId = open.id;
    }
  }

  // Optional follow-up draft.
  let followUpId: string | undefined;
  if (triage.needs_follow_up && contactId) {
    const contact = getContact(contactId);
    const deal = dealId ? getDeal(dealId) : undefined;
    if (contact) {
      const draft = await draftFollowUp({
        contact,
        deal,
        lastEmail: email,
      });
      const created = createFollowUp({
        contactId,
        dealId,
        emailId: email.id,
        subject: draft.subject,
        draft: draft.body,
        reason: draft.reason,
      });
      followUpId = created.id;
    }
  }

  // Mark the email processed and link back to anything we created.
  updateEmail(email.id, {
    processed: true,
    category: triage.category,
    priority: triage.priority,
    summary: triage.summary,
    contactId,
    dealId,
    followUpId,
  });

  return {
    emailId: email.id,
    category: triage.category,
    priority: triage.priority,
    summary: triage.summary,
    contactId,
    dealId,
    followUpId,
  };
}

export async function processAllUnprocessed(): Promise<PipelineResult[]> {
  const queue = listEmails().filter((e) => !e.processed);
  const results: PipelineResult[] = [];
  for (const email of queue) {
    // Re-fetch each time in case earlier iterations mutated related records.
    const fresh = getEmail(email.id);
    if (!fresh || fresh.processed) continue;
    results.push(await processEmail(fresh));
  }
  return results;
}
