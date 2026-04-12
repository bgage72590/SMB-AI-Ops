import {
  createDeal,
  createFollowUp,
  findContactByEmail,
  findOpenDealForContact,
  getContact,
  getDeal,
  getEmail,
  getUserById,
  isSenderBlocked,
  listEmails,
  logAudit,
  updateDeal,
  updateEmail,
  upsertContact,
} from "./store";
import { draftFollowUp, triageEmailSafe } from "./ai";
import { generateIcs, parseSchedulingTime } from "./ical";
import {
  formatAvailabilityForPrompt,
  getAvailability,
  refreshAccessToken,
} from "./google-calendar";
import { checkUsageLimits } from "./plans";
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
  const owner = getUserById(userId);
  if (owner) {
    const limits = checkUsageLimits(owner);
    if (limits.overLimit) {
      console.warn(
        `User ${userId} over email limit (${limits.emailsUsed}/${limits.emailsLimit}), skipping AI pipeline`
      );
      updateEmail(userId, email.id, { processed: true });
      return {
        emailId: email.id,
        category: "other",
        priority: "normal",
        summary: "Plan email limit reached — upgrade to process more emails.",
      };
    }
  }

  if (isSenderBlocked(userId, email.from)) {
    updateEmail(userId, email.id, {
      processed: true,
      category: "other",
      priority: "low",
      summary: "Sender is on your blocklist.",
    });
    logAudit(userId, "blocked", "email", email.id, `Blocked sender: ${email.from}`);
    return {
      emailId: email.id,
      category: "other",
      priority: "low",
      summary: "Sender is on your blocklist.",
    };
  }

  const triage = await triageEmailSafe(email, { userId });

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
      let calendarAvailability: string | undefined;
      if (
        owner?.googleCalendarEnabled &&
        owner.googleRefreshToken &&
        (triage.category === "scheduling" || triage.category === "new_lead")
      ) {
        try {
          const refreshed = await refreshAccessToken(owner.googleRefreshToken);
          const avail = await getAvailability(refreshed.accessToken);
          calendarAvailability = formatAvailabilityForPrompt(avail);
        } catch (err) {
          console.warn("Failed to fetch calendar availability:", err);
        }
      }
      const draft = await draftFollowUp({
        contact,
        deal,
        lastEmail: email,
        category: triage.category,
        schedulingLink,
        calendarAvailability,
        userId,
      });
      let icsData: string | undefined;
      if (
        triage.category === "scheduling" ||
        triage.category === "new_lead"
      ) {
        const parsed = parseSchedulingTime(
          `${email.subject} ${email.body}`
        );
        if (parsed) {
          const end = new Date(parsed.getTime() + 60 * 60 * 1000);
          icsData = generateIcs({
            uid: `${email.id}@smbaiops`,
            summary: deal?.title || email.subject,
            description: triage.summary,
            start: parsed,
            end,
            attendee: contact
              ? { name: contact.name, email: contact.email }
              : undefined,
          });
        }
      }
      const created = createFollowUp(userId, {
        contactId,
        dealId,
        emailId: email.id,
        subject: draft.subject,
        draft: draft.body,
        reason: draft.reason,
        scheduledFor: icsData
          ? parseSchedulingTime(`${email.subject} ${email.body}`)?.toISOString()
          : undefined,
        icsData,
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

  logAudit(
    userId,
    "processed",
    "email",
    email.id,
    `${triage.category} / ${triage.priority}: ${triage.summary.slice(0, 120)}`
  );
  if (dealId) {
    logAudit(userId, contactId ? "updated" : "created", "deal", dealId);
  }
  if (followUpId) {
    logAudit(userId, "drafted", "followUp", followUpId);
  }

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
