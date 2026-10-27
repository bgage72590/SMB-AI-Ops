import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  AuthError,
  SESSION_COOKIE,
  issueEmailVerification,
  logoutSession,
  signup,
  verificationEmail,
} from "@/lib/auth";
import { sendAccountLink } from "@/lib/accountEmail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "password must be at least 8 characters"),
  name: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`signup:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = SignupSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const oldSessionId = (await cookies()).get(SESSION_COOKIE)?.value;
    if (oldSessionId) {
      try { logoutSession(oldSessionId); } catch {}
    }
    const result = signup(parsed.data);
    const verifyUrl = issueEmailVerification(result.user.id);
    await sendAccountLink({
      to: result.user.email,
      url: verifyUrl,
      purpose: "verify-email",
      ...verificationEmail(result.user.name, verifyUrl),
    });
    const response = NextResponse.json({
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
    });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: result.sessionId,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(result.expiresAt),
    });
    return response;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
