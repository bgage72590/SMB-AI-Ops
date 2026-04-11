import type { Contact, Deal, Email, FollowUp, User } from "./types";
import {
  listAllUsers,
  listContacts,
  listDeals,
  listEmails,
  listFollowUps,
} from "./store";
import { isAIConfigured } from "./ai";
import { isPostmarkConfigured, sendEmail } from "./postmark";
import Anthropic from "@anthropic-ai/sdk";

// Weekly AI digest. A single endpoint iterates every user, builds a
// summary of what happened in the last 7 days, asks Claude for a short
// "here's what to focus on this week" paragraph, and emails it.
//
// This module is split from the route so it's unit-testable and can be
// called from a script, a cron job, or the API.

const DIGEST_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface DigestStats {
  newEmails: number;
  newContacts: number;
  pendingFollowUps: number;
  openPipelineValue: number;
  dealsByStage: Record<string, number>;
  topLeads: Array<{ name: string; summary: string }>;
}

export interface UserDigest {
  user: User;
  stats: DigestStats;
  headline: string; // AI-written or heuristic
  body: string; // full plaintext body that gets emailed
  subject: string;
}

export interface DigestRunResult {
  attempted: number;
  emailed: number;
  skipped: number;
  errors: Array<{ userId: string; message: string }>;
}

function isRecent(iso: string | undefined, sinceMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= sinceMs;
}

export function computeStats(userId: string, asOf: number = Date.now()): DigestStats {
  const since = asOf - WEEK_MS;

  const emails = listEmails(userId);
  const contacts = listContacts(userId);
  const deals = listDeals(userId);
  const followUps = listFollowUps(userId);

  const newEmails = emails.filter((e) => isRecent(e.receivedAt, since)).length;
  const newContacts = contacts.filter((c) => isRecent(c.createdAt, since)).length;
  const pendingFollowUps = followUps.filter((f) => f.status === "draft").length;

  const openStages = new Set(["lead", "qualified", "proposal", "negotiation"]);
  const openDeals = deals.filter((d) => openStages.has(d.stage));
  const openPipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);

  const dealsByStage: Record<string, number> = {};
  for (const d of openDeals) {
    dealsByStage[d.stage] = (dealsByStage[d.stage] || 0) + 1;
  }

  // Top leads = most recent high-priority new_lead emails this week.
  const topLeads = emails
    .filter((e) => isRecent(e.receivedAt, since))
    .filter((e) => e.category === "new_lead")
    .slice(0, 5)
    .map((e) => ({
      name: e.fromName || e.from,
      summary: e.summary || e.subject,
    }));

  return {
    newEmails,
    newContacts,
    pendingFollowUps,
    openPipelineValue,
    dealsByStage,
    topLeads,
  };
}

/**
 * Ask Claude for the lead paragraph. Falls back to a templated headline
 * when ANTHROPIC_API_KEY isn't set so the job still runs end-to-end.
 */
export async function writeHeadline(
  user: User,
  stats: DigestStats
): Promise<string> {
  if (!isAIConfigured()) return heuristicHeadline(stats);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const context = JSON.stringify(stats, null, 2);
  try {
    const res = await client.messages.create({
      model: DIGEST_MODEL,
      max_tokens: 400,
      system:
        "You write a single short paragraph (3-4 sentences) that tells a small business owner what to focus on this week. You are direct, specific, and never invent facts not in the stats. No greeting, no signoff — just the paragraph.",
      messages: [
        {
          role: "user",
          content: `Stats for the past 7 days for ${user.name}:\n\n${context}\n\nWrite the focus paragraph now.`,
        },
      ],
    });
    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    return text || heuristicHeadline(stats);
  } catch (err) {
    console.warn("digest headline failed, using heuristic:", err);
    return heuristicHeadline(stats);
  }
}

function heuristicHeadline(stats: DigestStats): string {
  const parts: string[] = [];
  if (stats.newEmails > 0) {
    parts.push(
      `You got ${stats.newEmails} email${stats.newEmails === 1 ? "" : "s"} this week`
    );
  }
  if (stats.topLeads.length > 0) {
    parts.push(
      `including ${stats.topLeads.length} new lead${stats.topLeads.length === 1 ? "" : "s"}`
    );
  }
  if (stats.pendingFollowUps > 0) {
    parts.push(
      `and you have ${stats.pendingFollowUps} draft follow-up${stats.pendingFollowUps === 1 ? "" : "s"} waiting to approve`
    );
  }
  if (stats.openPipelineValue > 0) {
    parts.push(
      `Open pipeline is worth $${stats.openPipelineValue.toLocaleString()}`
    );
  }
  if (parts.length === 0) {
    return "Quiet week. Nothing new came through, but your open pipeline is ready whenever you want to push it forward.";
  }
  return parts.join(". ") + ".";
}

export function renderDigestBody(user: User, stats: DigestStats, headline: string): string {
  const lines: string[] = [];
  lines.push(`Good morning ${user.name.split(" ")[0]},`);
  lines.push("");
  lines.push(headline);
  lines.push("");
  lines.push("— This week at a glance —");
  lines.push(`• New emails: ${stats.newEmails}`);
  lines.push(`• New contacts: ${stats.newContacts}`);
  lines.push(`• Draft follow-ups waiting: ${stats.pendingFollowUps}`);
  lines.push(
    `• Open pipeline value: $${stats.openPipelineValue.toLocaleString()}`
  );

  if (Object.keys(stats.dealsByStage).length > 0) {
    lines.push("");
    lines.push("— Open deals by stage —");
    for (const [stage, count] of Object.entries(stats.dealsByStage)) {
      lines.push(`• ${stage}: ${count}`);
    }
  }

  if (stats.topLeads.length > 0) {
    lines.push("");
    lines.push("— New leads to look at —");
    for (const lead of stats.topLeads) {
      lines.push(`• ${lead.name}: ${lead.summary}`);
    }
  }

  lines.push("");
  lines.push("Open your dashboard to take action:");
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (base) lines.push(base.replace(/\/$/, ""));
  lines.push("");
  lines.push("— SMB AI Ops");
  return lines.join("\n");
}

export async function buildUserDigest(user: User): Promise<UserDigest> {
  const stats = computeStats(user.id);
  const headline = await writeHeadline(user, stats);
  const body = renderDigestBody(user, stats, headline);
  const subject = `Focus for this week — ${new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
  return { user, stats, headline, body, subject };
}

/**
 * Run the digest for every user in the store. Designed to be called from
 * a scheduled trigger (Vercel cron, an external scheduler, or a local
 * `npm run digest`). Returns a summary of outcomes.
 */
export async function runWeeklyDigest(): Promise<DigestRunResult> {
  const result: DigestRunResult = {
    attempted: 0,
    emailed: 0,
    skipped: 0,
    errors: [],
  };

  const users = listAllUsers();
  for (const user of users) {
    result.attempted++;
    try {
      const digest = await buildUserDigest(user);
      if (!isPostmarkConfigured()) {
        // In dev, log the digest so operators can see what would ship
        // without needing a Postmark account.
        console.log(
          `[digest] (dev, would email ${user.email})\n${digest.subject}\n${digest.body}`
        );
        result.skipped++;
        continue;
      }
      await sendEmail({
        to: user.email,
        subject: digest.subject,
        body: digest.body,
      });
      result.emailed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ userId: user.id, message });
    }
  }

  return result;
}
