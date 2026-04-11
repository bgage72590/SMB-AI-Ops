import { NextResponse } from "next/server";
import { createEmail } from "@/lib/store";
import { processEmail } from "@/lib/pipeline";
import {
  verifyInboundSecret,
  type PostmarkInboundPayload,
} from "@/lib/postmark";

export const runtime = "nodejs";

// Postmark inbound webhook.
//
// Configure the webhook URL in Postmark's inbound stream settings. Either:
//   1) Put the secret in the URL as Basic Auth: https://user:secret@host/api/webhooks/postmark/inbound
//   2) Or append ?token=<secret> to the URL.
//
// The shared secret lives in POSTMARK_INBOUND_SECRET. Requests without a
// matching secret get a flat 401.
export async function POST(request: Request) {
  if (!verifyInboundSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PostmarkInboundPayload;
  try {
    payload = (await request.json()) as PostmarkInboundPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!payload.From || !payload.To || !payload.Subject) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 }
    );
  }

  // Prefer the plain-text body; fall back to stripped HTML if only HTML was
  // sent. We never store raw HTML — keeps the UI simple and the AI prompt
  // cheap.
  const body =
    payload.TextBody?.trim() ||
    payload.StrippedTextReply?.trim() ||
    stripHtml(payload.HtmlBody || "") ||
    "(empty body)";

  const email = createEmail({
    from: payload.From,
    fromName: payload.FromName || payload.FromFull?.Name,
    to: payload.To,
    subject: payload.Subject,
    body,
    receivedAt: payload.Date ? new Date(payload.Date).toISOString() : undefined,
  });

  // Run the pipeline synchronously. Postmark retries on non-2xx so we want
  // the side-effects committed before we ack.
  try {
    const result = await processEmail(email);
    return NextResponse.json({ ok: true, emailId: email.id, result });
  } catch (err) {
    // The email is already persisted; the pipeline can be re-run later via
    // /api/process. Ack with 200 so Postmark doesn't retry.
    console.error("postmark inbound pipeline failed:", err);
    return NextResponse.json(
      { ok: true, emailId: email.id, processed: false },
      { status: 200 }
    );
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
