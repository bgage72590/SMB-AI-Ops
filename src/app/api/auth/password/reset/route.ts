import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, completePasswordReset } from "@/lib/auth";

export const runtime = "nodejs";

const ResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

/**
 * Exchange a one-shot reset token for a new password. On success every
 * existing session for the user is revoked so a stolen cookie can't keep
 * masquerading after a reset.
 */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = ResetSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    completePasswordReset({
      token: parsed.data.token,
      newPassword: parsed.data.password,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
