import type { User, Deal, FollowUp } from "./types";
import { OPEN_DEAL_STAGES } from "./types";
import {
  listAllUsers,
  listEmails,
  listDeals,
  listFollowUps,
  listContacts,
  getContact,
} from "./store";
import { isEmailConfigured, sendEmail } from "./sendgrid";

const STALE_DAYS = 7;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

export interface NotificationResult {
  attempted: number;
  emailed: number;
  skipped: number;
  errors: Array<{ userId: string; message: string }>;
}

export interface UserAlerts {
  newLeads: Array<{ name: string; subject: string; receivedAt: string }>;
  staleJobs: Array<{ title: string; stage: string; daysSinceActivity: number; contactName: string }>;
  pendingFollowUps: Array<{ subject: string; contactName: string; createdAt: string }>;
}

export function getAlerts(userId: string, now: number = Date.now()): UserAlerts {
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const emails = listEmails(userId);
  const newLeads = emails
    .filter(
      (e) =>
        e.processed &&
        e.category === "new_lead" &&
        new Date(e.receivedAt).getTime() >= oneDayAgo
    )
    .map((e) => ({
      name: e.fromName || e.from,
      subject: e.subject,
      receivedAt: e.receivedAt,
    }));

  const deals = listDeals(userId);
  const openStages = new Set<string>(OPEN_DEAL_STAGES as readonly string[]);
  const staleJobs = deals
    .filter((d) => {
      if (!openStages.has(d.stage)) return false;
      const lastActivity = new Date(d.lastActivityAt).getTime();
      return now - lastActivity >= STALE_MS;
    })
    .map((d) => {
      const contact = getContact(userId, d.contactId);
      return {
        title: d.title,
        stage: d.stage,
        daysSinceActivity: Math.floor(
          (now - new Date(d.lastActivityAt).getTime()) / (24 * 60 * 60 * 1000)
        ),
        contactName: contact?.name || "Unknown",
      };
    })
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

  const followUps = listFollowUps(userId);
  const pendingFollowUps = followUps
    .filter((f) => f.status === "draft")
    .map((f) => {
      const contact = getContact(userId, f.contactId);
      return {
        subject: f.subject,
        contactName: contact?.name || "Unknown",
        createdAt: f.createdAt,
      };
    });

  return { newLeads, staleJobs, pendingFollowUps };
}

function hasAlerts(alerts: UserAlerts): boolean {
  return (
    alerts.newLeads.length > 0 ||
    alerts.staleJobs.length > 0 ||
    alerts.pendingFollowUps.length > 0
  );
}

function renderAlertEmail(user: User, alerts: UserAlerts): { subject: string; body: string } {
  const parts: string[] = [];
  const counts: string[] = [];

  if (alerts.newLeads.length > 0) {
    counts.push(
      `${alerts.newLeads.length} new lead${alerts.newLeads.length === 1 ? "" : "s"}`
    );
  }
  if (alerts.staleJobs.length > 0) {
    counts.push(
      `${alerts.staleJobs.length} stale job${alerts.staleJobs.length === 1 ? "" : "s"}`
    );
  }
  if (alerts.pendingFollowUps.length > 0) {
    counts.push(
      `${alerts.pendingFollowUps.length} pending follow-up${alerts.pendingFollowUps.length === 1 ? "" : "s"}`
    );
  }

  const subject = `Action needed: ${counts.join(", ")}`;

  parts.push(`Hi ${user.name.split(" ")[0]},`);
  parts.push("");
  parts.push("Here's what needs your attention:");

  if (alerts.newLeads.length > 0) {
    parts.push("");
    parts.push("--- New leads (last 24h) ---");
    for (const lead of alerts.newLeads.slice(0, 10)) {
      parts.push(`  * ${lead.name}: ${lead.subject}`);
    }
  }

  if (alerts.staleJobs.length > 0) {
    parts.push("");
    parts.push(`--- Stale jobs (no activity in ${STALE_DAYS}+ days) ---`);
    for (const job of alerts.staleJobs.slice(0, 10)) {
      parts.push(
        `  * ${job.title} (${job.contactName}) - ${job.daysSinceActivity} days idle`
      );
    }
  }

  if (alerts.pendingFollowUps.length > 0) {
    parts.push("");
    parts.push("--- Pending follow-ups ---");
    for (const fu of alerts.pendingFollowUps.slice(0, 10)) {
      parts.push(`  * ${fu.contactName}: ${fu.subject}`);
    }
  }

  parts.push("");
  const base =
    process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (base) {
    parts.push(`Open your dashboard: ${base.replace(/\/$/, "")}`);
    parts.push("");
  }
  parts.push("-- SMB AI Ops");

  return { subject, body: parts.join("\n") };
}

export async function runNotifications(): Promise<NotificationResult> {
  const result: NotificationResult = {
    attempted: 0,
    emailed: 0,
    skipped: 0,
    errors: [],
  };

  const users = listAllUsers();
  for (const user of users) {
    result.attempted++;
    try {
      const alerts = getAlerts(user.id);
      if (!hasAlerts(alerts)) {
        result.skipped++;
        continue;
      }

      const { subject, body } = renderAlertEmail(user, alerts);

      if (!isEmailConfigured()) {
        console.log(
          `[notifications] (dev, would email ${user.email})\n${subject}\n${body}`
        );
        result.skipped++;
        continue;
      }

      await sendEmail({ to: user.email, subject, body });
      result.emailed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ userId: user.id, message });
    }
  }

  return result;
}
