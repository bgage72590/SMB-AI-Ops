import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/auth";
import { isPostmarkConfigured, sendEmail } from "@/lib/postmark";

export const runtime = "nodejs";

const RequestSchema = z.object({ email: z.string().email() });

/**
 * Mint a password-reset token for the given email. This route always
 * returns `{ ok: true }` regardless of whether the email exists — the
 * response must not leak whether an account is registered.
 *
 * In production, with POSTMARK_SERVER_TOKEN + POSTMARK_FROM_EMAIL set,
 * we mail the reset link via Postmark. Otherwise we log it to stdout so
 * the developer can still walk the flow locally.
 */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) {
    // Swallow validation errors — same fail-closed shape as success so
    // callers can't distinguish known/unknown emails by status code.
    return NextResponse.json({ ok: true });
  }

  const { resetUrl } = requestPasswordReset({ email: parsed.data.email });

  if (resetUrl) {
    if (isPostmarkConfigured()) {
      try {
        await sendEmail({
          to: parsed.data.email,
          subject: "Reset your SMB AI Ops password",
          body:
            `Someone requested a password reset for this account.\n\n` +
            `Open this link within the next hour to set a new password:\n${resetUrl}\n\n` +
            `If you didn't request this, you can safely ignore this email — your password won't change.`,
        });
      } catch (err) {
        // Don't leak the failure to the client, but surface it in server
        // logs so operators can spot an outage.
        console.error("[password-reset] send failed", err);
      }
    } else {
      // Dev fallback — the URL is the only way to actually walk the flow.
      console.log(`[password-reset] ${parsed.data.email} -> ${resetUrl}`);
    }
  }

  return NextResponse.json({ ok: true });
}
