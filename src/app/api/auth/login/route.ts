import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { AuthError, SESSION_COOKIE, login, logoutSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Per-account lockout too, so spreading guesses across many IPs doesn't
  // get more tries at one password.
  const accountLimit = checkRateLimit(
    `login-acct:${parsed.data.email.trim().toLowerCase()}`,
    10,
    15 * 60 * 1000
  );
  if (!accountLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: accountLimit.retryAfterMs },
      { status: 429 }
    );
  }

  try {
    const oldSessionId = (await cookies()).get(SESSION_COOKIE)?.value;
    if (oldSessionId) {
      try { logoutSession(oldSessionId); } catch {}
    }
    const result = login(parsed.data);
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
