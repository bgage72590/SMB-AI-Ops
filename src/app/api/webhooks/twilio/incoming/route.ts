import { NextResponse } from "next/server";
import {
  createSmsMessage,
  findContactByPhone,
  findUserBySmsNumber,
} from "@/lib/store";
import { publicWebhookUrl, verifyTwilioSignature } from "@/lib/twilio";

export const runtime = "nodejs";

const EMPTY_TWIML = "<Response></Response>";

function twiml(body = EMPTY_TWIML, status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/xml" } });
}

// Twilio inbound SMS webhook. Point every workspace's number at this URL.
// The number a text was sent *to* says which workspace it belongs to.
export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return twiml("<Response><Message>SMS not configured</Message></Response>");
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const params = [...formData.entries()].map(
    ([k, v]) => [k, typeof v === "string" ? v : ""] as [string, string]
  );
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!verifyTwilioSignature(authToken, publicWebhookUrl(request), params, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  const from = (formData.get("From") as string) || "";
  const to = (formData.get("To") as string) || "";
  const body = (formData.get("Body") as string) || "";
  const messageSid = (formData.get("MessageSid") as string) || "";

  if (!from || !body) return twiml();

  const owner = findUserBySmsNumber(to);
  if (!owner) {
    console.warn(`[twilio inbound] no workspace owns ${to}; dropped`);
    return twiml();
  }

  const contact = findContactByPhone(owner.id, from);
  if (!contact) {
    console.warn(`[twilio inbound] ${to}: sender isn't a contact; dropped`);
    return twiml();
  }

  createSmsMessage({
    userId: owner.id,
    contactId: contact.id,
    direction: "inbound",
    fromNumber: from,
    toNumber: to,
    body,
    twilioSid: messageSid,
    status: "received",
  });

  return twiml();
}
