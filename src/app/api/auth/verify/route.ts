import { NextResponse } from "next/server";
import { AuthError, verifyEmail } from "@/lib/auth";

export const runtime = "nodejs";

// The link in the verification email. It works in any browser, signed in
// or not: holding the token is the proof.
export async function GET(request: Request) {
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    verifyEmail(token);
    return NextResponse.redirect(new URL("/?verified=1", base));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.redirect(new URL(`/?verify_error=${err.code}`, base));
    }
    throw err;
  }
}
