import { NextResponse } from "next/server";
import { z } from "zod";
import { getContact, getFollowUp, updateFollowUp } from "@/lib/store";
import { isPostmarkConfigured, sendEmail } from "@/lib/postmark";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { trialGuardResponse } from "@/lib/trialGuard";

export const runtime = "nodejs";

const SendSchema = z.object({ id: z.string().min(1) });

// POST /api/followups/send
// Body: { id: string }
//
// Actually dispatches the drafted follow-up via Postmark, then marks the
// follow-up as "sent". If Postmark isn't configured, returns 412 so the UI
// can point the user at the setup docs.
export async function POST(request: Request) {
  let user;
  try {
    user = requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const blocked = trialGuardResponse(user);
  if (blocked) return blocked;

  const payload = await request.json().catch(() => null);
  const parsed = SendSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  if (!isPostmarkConfigured()) {
    return NextResponse.json(
      {
        error: "postmark_not_configured",
        message:
          "Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL in .env to enable sending.",
      },
      { status: 412 }
    );
  }

  const followUp = getFollowUp(user.id, parsed.data.id);
  if (!followUp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (followUp.status === "sent") {
    return NextResponse.json({ followUp });
  }

  const contact = getContact(user.id, followUp.contactId);
  if (!contact) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 });
  }

  try {
    const result = await sendEmail({
      to: contact.email,
      subject: followUp.subject,
      body: followUp.draft,
      replyTo: user.inboundAddress,
    });
    const updated = updateFollowUp(user.id, followUp.id, {
      status: "sent",
      sentAt: new Date().toISOString(),
      sentMessageId: result.messageId,
    });
    return NextResponse.json({ followUp: updated, messageId: result.messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    return NextResponse.json({ error: "send_failed", message }, { status: 502 });
  }
}
