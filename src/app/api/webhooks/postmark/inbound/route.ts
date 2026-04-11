import { NextResponse } from "next/server";
import { createEmail, findUserByInboundAddress, getFirstUser } from "@/lib/store";
import { processEmail } from "@/lib/pipeline";
import {
  verifyInboundAuth,
  type PostmarkInboundPayload,
} from "@/lib/postmark";

export const runtime = "nodejs";

// Postmark inbound webhook.
//
// Auth modes (see src/lib/postmark.ts for the full rules):
//   - Preferred: HMAC. Set POSTMARK_WEBHOOK_HMAC_SECRET and have your
//     signing proxy send `X-Signature: sha256=<hex>` computed over the
//     raw request body.
//   - Fallback: shared secret via POSTMARK_INBOUND_SECRET. Pass it as a
//     Bearer header, as Basic Auth (Postmark's URL format), or as
//     `?token=<secret>`.
//
// If neither env var is set, every request is rejected.
//
// Routing: after the request is authenticated we need to figure out which
// user owns the email. We first try to match the `To` address against any
// user's `inboundAddress` column; if no one claims it, we fall back to the
// first user in the DB (single-tenant install). If there are no users at
// all we 503 so Postmark retries after the operator sets up an account.
export async function POST(request: Request) {
  // HMAC has to verify over the exact bytes we received, so read once as
  // text and parse JSON ourselves below.
  const rawBody = await request.text();

  if (!verifyInboundAuth(request, rawBody)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PostmarkInboundPayload;
  try {
    payload = JSON.parse(rawBody) as PostmarkInboundPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!payload.From || !payload.To || !payload.Subject) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 }
    );
  }

  const owner =
    findUserByInboundAddress(payload.To) ??
    // Fall back to the first user so single-tenant installs "just work"
    // without anyone ever needing to set inboundAddress.
    getFirstUser();

  if (!owner) {
    // No one signed up yet. Return 503 so Postmark queues a retry — once
    // someone creates an account, the retry will land successfully.
    return NextResponse.json(
      { error: "no_workspace_configured" },
      { status: 503 }
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

  const email = createEmail(owner.id, {
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
    const result = await processEmail(owner.id, email);
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
