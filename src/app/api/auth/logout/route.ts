import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, logoutSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const jar = cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    try {
      logoutSession(sessionId);
    } catch {
      // Best-effort — we still want to clear the cookie even if the row
      // is already gone.
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
  return response;
}
