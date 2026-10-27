// Delivery for account links (email verification, password reset).
// Sends through SendGrid when it's configured. Without it, development
// logs the link so the flow can still be walked; production never logs
// it, because anyone who can read the logs could take over the account.

import { isEmailConfigured, sendEmail } from "./sendgrid";

export async function sendAccountLink(input: {
  to: string;
  subject: string;
  body: string;
  url: string;
  /** Short tag for log lines, e.g. "verify-email". */
  purpose: string;
}): Promise<void> {
  if (isEmailConfigured()) {
    try {
      await sendEmail({ to: input.to, subject: input.subject, body: input.body });
    } catch (err) {
      // Don't fail the request, but surface the outage to operators.
      console.error(`[${input.purpose}] send failed`, err);
    }
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[${input.purpose}] ${input.to} -> ${input.url}`);
    return;
  }
  console.error(`[${input.purpose}] SendGrid isn't configured; can't email ${input.to}`);
}
