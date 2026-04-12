// Thin Twilio client. We hit the REST API directly with fetch (same pattern
// as postmark.ts) so we don't pull in another dependency for one endpoint.
//
// Env vars:
//   TWILIO_ACCOUNT_SID   — your Twilio account SID (ACxxxx)
//   TWILIO_AUTH_TOKEN     — auth token from the Twilio console
//   TWILIO_FROM_NUMBER    — the Twilio phone number to send from (+1xxxxxxxxxx)

export interface SendSmsInput {
  to: string;
  body: string;
}

export interface SendSmsResult {
  ok: true;
  messageSid: string;
  status: string;
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from) {
    throw new Error(
      "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER."
    );
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64"
  );

  const params = new URLSearchParams({
    To: input.to,
    From: from,
    Body: input.body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Twilio send failed (${response.status}): ${text || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    sid: string;
    status: string;
    error_code: number | null;
    error_message: string | null;
  };

  if (data.error_code) {
    throw new Error(`Twilio send failed: ${data.error_message}`);
  }

  return {
    ok: true,
    messageSid: data.sid,
    status: data.status,
  };
}
