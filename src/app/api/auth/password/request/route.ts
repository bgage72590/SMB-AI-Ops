import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/auth";
import { sendAccountLink } from "@/lib/accountEmail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const RequestSchema = z.object({ email: z.string().email() });

/**
 * Mint a password-reset token for the given email. This route always
 * returns `{ ok: true }` regardless of whether the email exists — the
 * response must not leak whether an account is registered.
 *
 * The link goes out through sendAccountLink(): SendGrid when configured,
 * the dev log otherwise, and never the log in production.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`pw-reset:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: true });
  }

  const payload = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) {
    // Swallow validation errors — same fail-closed shape as success so
    // callers can't distinguish known/unknown emails by status code.
    return NextResponse.json({ ok: true });
  }

  const { resetUrl } = requestPasswordReset({ email: parsed.data.email });

  if (resetUrl) {
    await sendAccountLink({
      to: parsed.data.email,
      url: resetUrl,
      purpose: "password-reset",
      subject: "Reset your SMB AI Ops password",
      body:
        `Someone requested a password reset for this account.\n\n` +
        `Open this link within the next hour to set a new password:\n${resetUrl}\n\n` +
        `If you didn't request this, you can safely ignore this email — your password won't change.`,
    });
  }

  return NextResponse.json({ ok: true });
}
