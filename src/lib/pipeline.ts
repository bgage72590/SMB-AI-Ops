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

// The "brain" that turns a raw email into CRM side-effects. Every route
// that wants to run the pipeline (manual trigger, webhook, cron) goes
// through here. Scoping is explicit: every entry point takes a userId
// and every store call is scoped against it.

export interface PipelineResult {
  emailId: string;
  category: string;
  priority: string;
  summary: string;
  contactId?: string;
  dealId?: string;
  followUpId?: string;
}

export async function processEmail(
  userId: string,
  email: Email
): Promise<PipelineResult> {
  const triage = await triageEmailSafe(email);

  // Resolve or create contact.
  let contactId: string | undefined;
  if (triage.suggested_contact) {
    const c = upsertContact(userId, {
      name: triage.suggested_contact.name,
      email: triage.suggested_contact.email,
      company: triage.suggested_contact.company,
    });
    contactId = c.id;
  } else {
    const existing = findContactByEmail(userId, email.from);
    if (existing) {
      contactId = existing.id;
    } else if (triage.category !== "other" && triage.category !== "invoice") {
      const c = upsertContact(userId, {
        name: email.fromName || email.from,
        email: email.from,
      });
      contactId = c.id;
    }
  }

  // Resolve or create / update deal.
  let dealId: string | undefined;
  if (contactId && triage.suggested_deal) {
    const open = findOpenDealForContact(userId, contactId);
    if (open) {
      const updated = updateDeal(userId, open.id, {
        stage: triage.suggested_deal.stage,
        amount: triage.suggested_deal.amount ?? open.amount,
        nextStep: triage.suggested_deal.next_step ?? open.nextStep,
        title: triage.suggested_deal.title || open.title,
      });
      dealId = updated?.id;
    } else {
      const created = createDeal(userId, {
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
    const open = findOpenDealForContact(userId, contactId);
    if (open && triage.category === "deal_update") {
      updateDeal(userId, open.id, {});
      dealId = open.id;
    }
  }

  // Optional follow-up draft.
  let followUpId: string | undefined;
  if (triage.needs_follow_up && contactId) {
    const contact = getContact(userId, contactId);
    const deal = dealId ? getDeal(userId, dealId) : undefined;
    if (contact) {
      // Pass the owner's self-serve scheduling link (Cal.com, Calendly,
      // etc.) when it's configured. The model decides whether to include
      // it based on the triage category — we hand it over unconditionally
      // rather than gating on `category === "scheduling"` because
      // deal_update/new_lead replies often end with "let's find time" too.
      const schedulingLink = process.env.SCHEDULING_LINK?.trim() || undefined;
      const draft = await draftFollowUp({
        contact,
        deal,
        lastEmail: email,
        category: triage.category,
        schedulingLink,
      });
      const created = createFollowUp(userId, {
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
  updateEmail(userId, email.id, {
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

export async function processAllUnprocessed(
  userId: string
): Promise<PipelineResult[]> {
  const queue = listEmails(userId).filter((e) => !e.processed);
  const results: PipelineResult[] = [];
  for (const email of queue) {
    // Re-fetch each time in case earlier iterations mutated related records.
    const fresh = getEmail(userId, email.id);
    if (!fresh || fresh.processed) continue;
    results.push(await processEmail(userId, fresh));
  }
  return results;
}
