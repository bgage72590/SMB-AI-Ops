import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AuthError,
  SESSION_COOKIE,
  requireUserForApi,
  verifyPassword,
} from "@/lib/auth";
import { deleteUserData, getPasswordHashByEmail, logAudit } from "@/lib/store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const DeleteSchema = z.object({
  password: z.string().min(1),
  confirm: z.literal("DELETE MY ACCOUNT"),
});

/**
 * POST /api/account/delete
 * Body: { password: string, confirm: "DELETE MY ACCOUNT" }
 *
 * Permanently deletes all user data and signs the user out. Requires
 * the current password and an explicit confirmation string to prevent
 * accidental deletion.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`delete-account:${ip}`, 3, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 }
    );
  }

  let user;
  try {
    user = requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const payload = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", message: 'Send { password, confirm: "DELETE MY ACCOUNT" }' },
      { status: 400 }
    );
  }

  const hash = getPasswordHashByEmail(user.email);
  if (!hash || !verifyPassword(parsed.data.password, hash)) {
    return NextResponse.json(
      { error: "invalid_password" },
      { status: 403 }
    );
  }

  logAudit(user.id, "account_deleted", "user", user.id, `Self-service deletion by ${user.email}`);

  const tablesCleared = deleteUserData(user.id);

  const response = NextResponse.json({
    ok: true,
    tablesCleared,
    message: "All your data has been permanently deleted.",
  });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
