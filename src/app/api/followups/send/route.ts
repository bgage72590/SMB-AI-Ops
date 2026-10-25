import { NextResponse } from "next/server";
import { z } from "zod";
import { getContact, getFollowUp, logAudit, updateFollowUp } from "@/lib/store";
import { isEmailConfigured, sendEmail } from "@/lib/sendgrid";
import { canSendSms, sendSms, smsUnavailableReason } from "@/lib/twilio";
import { apiRoute, chargePaid, requireFeature } from "@/lib/guard";

export const runtime = "nodejs";

const SendSchema = z.object({ id: z.string().min(1) });

// POST /api/followups/send
// Body: { id: string }
//
// Dispatches the follow-up via the appropriate channel (email or SMS).
// Email goes through SendGrid; SMS goes through Twilio.
export const POST = apiRoute({ rate: { bucket: "send", max: 30, windowMs: 10 * 60_000 } }, async (request, user) => {

  const payload = await request.json().catch(() => null);
  const parsed = SendSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
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

  if (followUp.channel === "sms") {
    requireFeature(user, "sms_followups");
    if (!canSendSms(user)) {
      return NextResponse.json(
        { error: "twilio_not_configured", message: smsUnavailableReason(user) },
        { status: 412 }
      );
    }
    if (!contact.phone) {
      return NextResponse.json(
        { error: "no_phone", message: "Contact has no phone number on file." },
        { status: 422 }
      );
    }
    chargePaid(user, "sms");
    try {
      const result = await sendSms({
        to: contact.phone,
        from: user.smsNumber!,
        body: followUp.draft,
      });
      const updated = updateFollowUp(user.id, followUp.id, {
        status: "sent",
        sentAt: new Date().toISOString(),
        sentMessageId: result.messageSid,
      });
      logAudit(user.id, "sent_sms", "followUp", followUp.id, `To: ${contact.phone}`);
      return NextResponse.json({ followUp: updated, messageSid: result.messageSid });
    } catch (err) {
      const message = err instanceof Error ? err.message : "send_failed";
      return NextResponse.json({ error: "send_failed", message }, { status: 502 });
    }
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error: "email_not_configured",
        message:
          "Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in .env to enable sending.",
      },
      { status: 412 }
    );
  }

  chargePaid(user, "email");
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
    logAudit(user.id, "sent", "followUp", followUp.id, `To: ${contact.email}`);
    return NextResponse.json({ followUp: updated, messageId: result.messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    return NextResponse.json({ error: "send_failed", message }, { status: 502 });
  }
});
