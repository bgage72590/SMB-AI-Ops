import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  Deal,
  Email,
  EmailCategory,
  EmailPriority,
  Contact,
} from "./types";

// Thin wrapper around the Anthropic SDK so the rest of the codebase doesn't
// need to know which model, prompts, or tool format we're using.
//
// Every call enables prompt caching on the static system prompt so repeated
// inbox processing runs cheaply.

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in."
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// ---------- Email triage ----------

const TriageSchema = z.object({
  category: z.enum([
    "new_lead",
    "deal_update",
    "invoice",
    "follow_up_needed",
    "scheduling",
    "other",
  ]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  summary: z.string().min(1).max(400),
  suggested_contact: z
    .object({
      name: z.string(),
      email: z.string(),
      company: z.string().optional(),
    })
    .optional(),
  suggested_deal: z
    .object({
      title: z.string(),
      stage: z.enum([
        "lead",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ]),
      amount: z.number().optional(),
      next_step: z.string().optional(),
    })
    .optional(),
  needs_follow_up: z.boolean(),
});

export type TriageResult = z.infer<typeof TriageSchema>;

const TRIAGE_SYSTEM = `You are the AI office manager for a small business owner.
You read raw email and extract structured information so the CRM stays up to date
without the owner having to touch it.

You ALWAYS respond by calling the provided tool. Never respond with prose.

Classification rules:
- "new_lead": first-touch prospects asking for a demo, quote, or information.
- "deal_update": existing customers/prospects responding about an in-flight deal.
- "invoice": payment confirmations, AR/AP, billing questions.
- "follow_up_needed": owner needs to reply but the prospect is waiting on them.
- "scheduling": meeting requests, reschedules, calendar coordination.
- "other": anything else (newsletters, spam, personal).

Priority rules:
- "urgent": explicit deadline, unhappy customer, blocker.
- "high": revenue on the line, prospect going cold, open question.
- "normal": routine updates.
- "low": informational, no action needed.

Always populate \`summary\` with ONE sentence the owner can scan in a second.
Only populate \`suggested_contact\` / \`suggested_deal\` when the email clearly
implies them. Set \`needs_follow_up\` to true if the owner should send a reply.`;

const TRIAGE_TOOL = {
  name: "record_triage",
  description: "Record structured triage output for a single email.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        enum: [
          "new_lead",
          "deal_update",
          "invoice",
          "follow_up_needed",
          "scheduling",
          "other",
        ],
      },
      priority: {
        type: "string",
        enum: ["low", "normal", "high", "urgent"],
      },
      summary: { type: "string" },
      suggested_contact: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          company: { type: "string" },
        },
        required: ["name", "email"],
      },
      suggested_deal: {
        type: "object",
        properties: {
          title: { type: "string" },
          stage: {
            type: "string",
            enum: [
              "lead",
              "qualified",
              "proposal",
              "negotiation",
              "won",
              "lost",
            ],
          },
          amount: { type: "number" },
          next_step: { type: "string" },
        },
        required: ["title", "stage"],
      },
      needs_follow_up: { type: "boolean" },
    },
    required: ["category", "priority", "summary", "needs_follow_up"],
  },
};

export async function triageEmail(email: Email): Promise<TriageResult> {
  const response = await client().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: TRIAGE_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [TRIAGE_TOOL],
    tool_choice: { type: "tool", name: "record_triage" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `From: ${email.fromName ? `${email.fromName} <${email.from}>` : email.from}
Subject: ${email.subject}
Received: ${email.receivedAt}

---
${email.body}`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not call record_triage tool");
  }
  return TriageSchema.parse(toolUse.input);
}

// Non-throwing variant with a heuristic fallback so the pipeline keeps moving
// even if the API key is missing or rate-limited. We still return something
// usable rather than erroring the whole batch.
export async function triageEmailSafe(email: Email): Promise<TriageResult> {
  if (!isAIConfigured()) return heuristicTriage(email);
  try {
    return await triageEmail(email);
  } catch (err) {
    console.warn("triageEmail failed, falling back to heuristic:", err);
    return heuristicTriage(email);
  }
}

function heuristicTriage(email: Email): TriageResult {
  const text = `${email.subject} ${email.body}`.toLowerCase();
  let category: EmailCategory = "other";
  if (/\b(invoice|paid|payment|ach|receipt)\b/.test(text)) category = "invoice";
  else if (/\b(demo|interested|pricing|quote|trial)\b/.test(text)) category = "new_lead";
  else if (/\b(proposal|sow|contract|revised|reviewed)\b/.test(text)) category = "deal_update";
  else if (/\b(meet|schedule|calendar|availability|reschedule)\b/.test(text)) category = "scheduling";
  else if (/\?/.test(email.body)) category = "follow_up_needed";

  const priority: EmailPriority =
    category === "new_lead" || category === "deal_update" ? "high" : "normal";

  return {
    category,
    priority,
    summary: email.subject,
    needs_follow_up: category === "new_lead" || category === "follow_up_needed",
    suggested_contact: email.fromName
      ? { name: email.fromName, email: email.from }
      : undefined,
  };
}

// ---------- Follow-up drafting ----------

const DRAFT_SYSTEM = `You draft short, human-sounding follow-up emails on behalf of
a small business owner. You are NOT a marketer — write like a founder would.

Rules:
- 4-7 sentences, no fluff.
- Lead with the concrete next step, not pleasantries.
- Never invent facts, prices, or timelines that aren't in the context.
- Sign off with "— [Owner]" as a placeholder the user will replace.
- If a "Scheduling link" is provided in the context AND the reply is about
  scheduling a call, meeting, demo, or intro, include the link verbatim on
  its own line and tell them to grab any slot that works. Do NOT invent or
  paraphrase the URL. If no link is provided, offer to send times yourself.
- Output JSON only, via the provided tool.`;

const DRAFT_TOOL = {
  name: "record_follow_up",
  description: "Record a drafted follow-up email for the owner to review.",
  input_schema: {
    type: "object" as const,
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
      reason: {
        type: "string",
        description: "One sentence on why this follow-up is needed.",
      },
    },
    required: ["subject", "body", "reason"],
  },
};

const DraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  reason: z.string().min(1),
});

export type FollowUpDraft = z.infer<typeof DraftSchema>;

export interface DraftFollowUpInput {
  contact: Contact;
  deal?: Deal;
  lastEmail?: Email;
  context?: string;
  /**
   * Optional self-serve scheduling URL (e.g. a Cal.com or Calendly link).
   * When provided, the model is instructed to include it verbatim on
   * scheduling-flavored replies instead of asking the owner to propose times.
   */
  schedulingLink?: string;
  /**
   * Triage category for the email this draft is replying to. Used purely as
   * a hint to the model so it can decide whether a scheduling link is
   * relevant.
   */
  category?: EmailCategory;
}

export async function draftFollowUp(
  input: DraftFollowUpInput
): Promise<FollowUpDraft> {
  if (!isAIConfigured()) return heuristicDraft(input);
  try {
    const response = await client().messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: DRAFT_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [DRAFT_TOOL],
      tool_choice: { type: "tool", name: "record_follow_up" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildDraftContext(input),
            },
          ],
        },
      ],
    });
    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Model did not call record_follow_up tool");
    }
    return DraftSchema.parse(toolUse.input);
  } catch (err) {
    console.warn("draftFollowUp failed, falling back:", err);
    return heuristicDraft(input);
  }
}

function buildDraftContext(input: DraftFollowUpInput): string {
  const parts: string[] = [];
  parts.push(`Contact: ${input.contact.name} <${input.contact.email}>`);
  if (input.contact.company) parts.push(`Company: ${input.contact.company}`);
  if (input.deal) {
    parts.push(
      `Deal: ${input.deal.title} — stage=${input.deal.stage}, amount=${input.deal.amount} ${input.deal.currency}`
    );
    if (input.deal.nextStep) parts.push(`Next step: ${input.deal.nextStep}`);
  }
  if (input.category) {
    parts.push(`Triage category: ${input.category}`);
  }
  if (input.schedulingLink) {
    parts.push(`Scheduling link: ${input.schedulingLink}`);
  }
  if (input.lastEmail) {
    parts.push("");
    parts.push(`Last email from them (subject: "${input.lastEmail.subject}"):`);
    parts.push(input.lastEmail.body);
  }
  if (input.context) {
    parts.push("");
    parts.push(`Additional context: ${input.context}`);
  }
  parts.push("");
  parts.push("Draft the follow-up now via the record_follow_up tool.");
  return parts.join("\n");
}

function heuristicDraft(input: DraftFollowUpInput): FollowUpDraft {
  const firstName = input.contact.name.split(" ")[0];
  const isScheduling = input.category === "scheduling";
  const lines: string[] = [`Hi ${firstName},`, ""];

  if (isScheduling && input.schedulingLink) {
    lines.push(
      `Happy to jump on a call — grab whatever slot works here:`,
      input.schedulingLink
    );
  } else if (isScheduling) {
    lines.push(`Happy to jump on a call. What does your week look like?`);
  } else if (input.deal) {
    lines.push(
      `Circling back on ${input.deal.title}. Where did things land on your side?`
    );
  } else {
    lines.push(`Just checking in — anything I can help unblock this week?`);
  }

  if (!isScheduling) {
    lines.push("");
    if (input.schedulingLink) {
      lines.push(`If it's easier, grab any slot here: ${input.schedulingLink}`);
    } else {
      lines.push(`Happy to jump on a quick call if easier.`);
    }
  }

  lines.push("", "— [Owner]");

  return {
    subject: input.lastEmail
      ? `Re: ${input.lastEmail.subject}`
      : input.deal
        ? `Quick check-in — ${input.deal.title}`
        : "Quick check-in",
    body: lines.join("\n"),
    reason: isScheduling
      ? "They asked to find a time — sending the scheduling link."
      : input.deal
        ? `Deal "${input.deal.title}" has gone quiet.`
        : "Maintaining contact with an active relationship.",
  };
}
