import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, SESSION_COOKIE, login } from "@/lib/auth";

export const runtime = "nodejs";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
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
