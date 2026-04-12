import { NextResponse } from "next/server";
import {
  createSmsMessage,
  findContactByPhone,
  listAllUsers,
} from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return new Response(
      '<Response><Message>SMS not configured</Message></Response>',
      { status: 200, headers: { "content-type": "text/xml" } }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const from = (formData.get("From") as string) || "";
  const to = (formData.get("To") as string) || "";
  const body = (formData.get("Body") as string) || "";
  const messageSid = (formData.get("MessageSid") as string) || "";

  if (!from || !body) {
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "content-type": "text/xml" },
    });
  }

  const users = listAllUsers();
  for (const user of users) {
    const contact = findContactByPhone(user.id, from);
    if (contact) {
      createSmsMessage({
        userId: user.id,
        contactId: contact.id,
        direction: "inbound",
        fromNumber: from,
        toNumber: to,
        body,
        twilioSid: messageSid,
        status: "received",
      });
      break;
    }
  }

  return new Response("<Response></Response>", {
    status: 200,
    headers: { "content-type": "text/xml" },
  });
}
