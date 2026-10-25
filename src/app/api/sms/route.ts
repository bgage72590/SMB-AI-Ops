import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireUserForApi } from "@/lib/auth";
import {
  createSmsMessage,
  getContact,
  listSmsConversations,
  listSmsMessages,
} from "@/lib/store";
import { canSendSms, sendSms, smsUnavailableReason } from "@/lib/twilio";

export const runtime = "nodejs";

const SendSchema = z.object({
  contactId: z.string().min(1),
  body: z.string().min(1).max(1600),
});

export async function GET(request: Request) {
  try {
    const user = await requireUserForApi();
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contactId");
    if (contactId) {
      const messages = listSmsMessages(user.id, contactId);
      return NextResponse.json({ messages });
    }
    const conversations = listSmsConversations(user.id);
    return NextResponse.json({ conversations });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  if (!canSendSms(user)) {
    return NextResponse.json(
      { error: "twilio_not_configured", message: smsUnavailableReason() },
      { status: 400 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = SendSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const contact = getContact(user.id, parsed.data.contactId);
  if (!contact) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 });
  }
  if (!contact.phone) {
    return NextResponse.json(
      { error: "no_phone", message: "This contact has no phone number." },
      { status: 400 }
    );
  }

  const result = await sendSms({
    to: contact.phone,
    from: user.smsNumber!,
    body: parsed.data.body,
  });

  const msg = createSmsMessage({
    userId: user.id,
    contactId: contact.id,
    direction: "outbound",
    fromNumber: user.smsNumber!,
    toNumber: contact.phone,
    body: parsed.data.body,
    twilioSid: result.messageSid,
    status: result.status,
  });

  return NextResponse.json({ message: msg }, { status: 201 });
}
