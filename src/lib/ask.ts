import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  listDeals,
  listContacts,
  listEmails,
  listFollowUps,
  sumAiUsageSince,
} from "./store";
import { computeWinRate, findAtRiskDeals, computeStageBreakdown } from "./reports";
import { isAIConfigured } from "./ai";
import { checkAiBudget, logAiUsage, type UsageLike } from "./aiUsage";
import type { User } from "./types";
import { OPEN_DEAL_STAGES } from "./types";

// Open-ended "ask box" — the owner types a natural language question
// like "What should I focus on this week?" or "Draft a hard-close email
// to Jordan." and the AI answers using the full CRM context.
//
// We build a context window with recent DB state, then let the model
// respond freely (no tool-use, just prose/drafts).

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

const ASK_SYSTEM = `You are the AI office manager for a local service business owner.
You have access to their full CRM data below: clients, jobs (deals), recent
emails, follow-up drafts, pipeline stats, and at-risk jobs.

Answer their question helpfully using this data. Be specific — reference
actual client names, job titles, dollar amounts, and dates. Keep answers
concise (under 300 words unless they ask for a longer draft).

If they ask you to draft an email or message, write it in full — ready to
copy and send. Sign off with "— [Owner]" as a placeholder.

If they ask "what should I focus on?", prioritize:
1. Urgent items (at-risk deals going cold, unanswered inquiries)
2. Revenue-critical (high-value quotes awaiting response)
3. Quick wins (follow-ups that just need a nudge)

Always ground your advice in the actual data. Never make up clients, jobs,
or numbers that aren't in the context.`;

export const AskResponseSchema = z.object({
  answer: z.string().min(1),
});

export type AskResponse = z.infer<typeof AskResponseSchema>;

function buildCrmContext(user: User): string {
  const userId = user.id;
  const parts: string[] = [];

  const contacts = listContacts(userId);
  const deals = listDeals(userId);
  const emails = listEmails(userId);
  const followUps = listFollowUps(userId);

  const openDeals = deals.filter((d) =>
    (OPEN_DEAL_STAGES as readonly string[]).includes(d.stage)
  );
  const pipelineValue = openDeals.reduce((s, d) => s + d.amount, 0);

  parts.push(`=== BUSINESS SNAPSHOT ===`);
  parts.push(`Total clients: ${contacts.length}`);
  parts.push(`Open jobs: ${openDeals.length} ($${pipelineValue.toLocaleString()} pipeline)`);
  parts.push(`Pending follow-up drafts: ${followUps.filter((f) => f.status === "draft").length}`);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const aiUsage = sumAiUsageSince(userId, weekAgo);
  parts.push(`AI spend (7d): $${aiUsage.totalCostUsd.toFixed(4)}`);

  const winRate = computeWinRate(userId);
  parts.push(`\n=== WIN RATE (90 days) ===`);
  parts.push(`Won: ${winRate.won} | Lost: ${winRate.lost} | Rate: ${Math.round(winRate.winRate * 100)}%`);
  parts.push(`Avg deal value: $${winRate.avgDealValue.toLocaleString()}`);
  parts.push(`Avg days to close: ${winRate.avgDaysToClose}`);

  const breakdown = computeStageBreakdown(userId);
  parts.push(`\n=== PIPELINE BY STAGE ===`);
  for (const b of breakdown) {
    if (b.count > 0) {
      parts.push(`${b.stage}: ${b.count} jobs, $${b.totalValue.toLocaleString()} (weighted: $${b.weightedValue.toLocaleString()})`);
    }
  }

  const atRisk = findAtRiskDeals(userId);
  if (atRisk.length > 0) {
    parts.push(`\n=== AT-RISK JOBS ===`);
    for (const r of atRisk.slice(0, 10)) {
      parts.push(`- ${r.deal.title} (${r.contactName}) — ${r.daysSinceActivity}d stale, $${r.deal.amount.toLocaleString()}: ${r.reason}`);
    }
  }

  parts.push(`\n=== CLIENTS (${Math.min(contacts.length, 30)}) ===`);
  for (const c of contacts.slice(0, 30)) {
    const line = [c.name, c.email];
    if (c.company) line.push(c.company);
    if (c.phone) line.push(c.phone);
    parts.push(`- ${line.join(" | ")}`);
  }

  parts.push(`\n=== OPEN JOBS ===`);
  for (const d of openDeals.slice(0, 20)) {
    const contact = contacts.find((c) => c.id === d.contactId);
    parts.push(`- ${d.title} | ${contact?.name || "Unknown"} | ${d.stage} | $${d.amount.toLocaleString()} | Next: ${d.nextStep || "none"} | Last: ${d.lastActivityAt}`);
  }

  const recentEmails = emails.filter((e) => e.processed).slice(0, 15);
  if (recentEmails.length > 0) {
    parts.push(`\n=== RECENT EMAILS (${recentEmails.length}) ===`);
    for (const e of recentEmails) {
      parts.push(`- [${e.category || "?"}] ${e.fromName || e.from}: ${e.subject} — ${e.summary || "(no summary)"}`);
    }
  }

  const pendingDrafts = followUps.filter((f) => f.status === "draft").slice(0, 10);
  if (pendingDrafts.length > 0) {
    parts.push(`\n=== PENDING DRAFTS ===`);
    for (const f of pendingDrafts) {
      const contact = contacts.find((c) => c.id === f.contactId);
      parts.push(`- To: ${contact?.name || "?"} | Subject: ${f.subject} | Reason: ${f.reason}`);
    }
  }

  return parts.join("\n");
}

export async function askQuestion(
  user: User,
  question: string
): Promise<AskResponse> {
  if (!isAIConfigured()) {
    return {
      answer:
        "AI is not configured — set ANTHROPIC_API_KEY in your environment to use the ask box.",
    };
  }

  if (checkAiBudget(user.id).exceeded) {
    return {
      answer:
        "Your weekly AI budget has been exceeded. The ask box will be available again when the budget window resets.",
    };
  }

  const context = buildCrmContext(user);

  const response = await client().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system: ASK_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${context}\n\n---\n\nOwner's question: ${question}`,
      },
    ],
  });

  logAiUsage({
    userId: user.id,
    kind: "ask",
    model: DEFAULT_MODEL,
    usage: response.usage as UsageLike,
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("\n");

  return { answer: text || "I wasn't able to generate a response. Please try again." };
}
