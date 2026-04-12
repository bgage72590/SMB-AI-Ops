import { NextResponse } from "next/server";
import {
  createEmail,
  findFollowUpBySentMessageId,
  findUserByInboundAddress,
  getFirstUser,
  updateEmail,
} from "@/lib/store";
import { processEmail } from "@/lib/pipeline";
import { enqueueEmailProcessing } from "@/lib/jobs";
import {
  verifyInboundAuth,
  type SendGridInboundPayload,
} from "@/lib/sendgrid";

// When JOB_QUEUE_MODE=async the webhook persists the email, enqueues a
// process_email job, and acks immediately. A separate drain
// (/api/jobs/run on a cron) does the LLM work.
const asyncMode = () => process.env.JOB_QUEUE_MODE === "async";

export const runtime = "nodejs";

// SendGrid Inbound Parse webhook.
//
// SendGrid sends inbound emails as multipart/form-data POST requests.
// Configure Inbound Parse at https://app.sendgrid.com/settings/parse
// to point at this endpoint.
//
// Auth: Set SENDGRID_INBOUND_SECRET and append ?token=<secret> to
// the webhook URL, or use SENDGRID_WEBHOOK_VERIFICATION_KEY for
// signed verification.
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  let payload: SendGridInboundPayload;

  if (contentType.includes("multipart/form-data")) {
    // SendGrid Inbound Parse sends multipart/form-data
    const formData = await request.formData();
    const envelope = formData.get("envelope") as string | null;
    let parsedEnvelope: { from?: string; to?: string[] } = {};
    try {
      parsedEnvelope = envelope ? JSON.parse(envelope) : {};
    } catch {}

    const fromField = (formData.get("from") as string) || "";
    const fromMatch = fromField.match(/<([^>]+)>/);
    const fromEmail = fromMatch ? fromMatch[1] : fromField;
    const fromNameMatch = fromField.match(/^([^<]+)</);
    const fromName = fromNameMatch ? fromNameMatch[1].trim().replace(/^"|"$/g, "") : undefined;

    payload = {
      from: fromEmail,
      fromName,
      to: (formData.get("to") as string) || parsedEnvelope.to?.[0] || "",
      subject: (formData.get("subject") as string) || "",
      text: (formData.get("text") as string) || undefined,
      html: (formData.get("html") as string) || undefined,
      headers: (formData.get("headers") as string) || undefined,
      envelope: envelope || undefined,
    };

    // For form-data, verify auth via query param or basic auth
    if (!verifyInboundAuth(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    // JSON mode (if configured in SendGrid as "raw")
    const rawBody = await request.text();
    if (!verifyInboundAuth(request, rawBody)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
      payload = JSON.parse(rawBody) as SendGridInboundPayload;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  if (!payload.from || !payload.to || !payload.subject) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 }
    );
  }

  // Route to the right user by matching the To address
  const toAddress = payload.to.includes("<")
    ? payload.to.match(/<([^>]+)>/)?.[1] || payload.to
    : payload.to;

  const owner =
    findUserByInboundAddress(toAddress) ?? getFirstUser();

  if (!owner) {
    return NextResponse.json(
      { error: "no_workspace_configured" },
      { status: 503 }
    );
  }

  const body =
    payload.text?.trim() ||
    stripHtml(payload.html || "") ||
    "(empty body)";

  const email = createEmail(owner.id, {
    from: payload.from,
    fromName: payload.fromName,
    to: toAddress,
    subject: payload.subject,
    body,
  });

  // Thread matching: check if this is a reply to a follow-up we sent
  if (payload.headers) {
    const replyIds = extractReplyMessageIds(payload.headers);
    for (const msgId of replyIds) {
      const original = findFollowUpBySentMessageId(owner.id, msgId);
      if (original) {
        updateEmail(owner.id, email.id, {
          contactId: original.contactId,
          dealId: original.dealId ?? undefined,
        });
        break;
      }
    }
  }

  if (asyncMode()) {
    const job = enqueueEmailProcessing(owner.id, email.id);
    return NextResponse.json({ ok: true, emailId: email.id, jobId: job.id });
  }

  try {
    const result = await processEmail(owner.id, email);
    return NextResponse.json({ ok: true, emailId: email.id, result });
  } catch (err) {
    console.error("sendgrid inbound pipeline failed:", err);
    return NextResponse.json(
      { ok: true, emailId: email.id, processed: false },
      { status: 200 }
    );
  }
}

function extractReplyMessageIds(headers: string): string[] {
  const ids: string[] = [];
  const lines = headers.split("\n");
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("in-reply-to:") || lower.startsWith("references:")) {
      const value = line.slice(line.indexOf(":") + 1);
      const matches = value.match(/<[^>]+>/g);
      if (matches) {
        for (const m of matches) ids.push(m.slice(1, -1));
      }
    }
  }
  return ids;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
