import { NextResponse } from "next/server";
import { issueEmailVerification, verificationEmail } from "@/lib/auth";
import { sendAccountLink } from "@/lib/accountEmail";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = apiRoute(
  { rate: { bucket: "verify-resend", max: 3, windowMs: 60 * 60_000 } },
  async (_request, user) => {
    if (user.emailVerifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    const url = issueEmailVerification(user.id);
    await sendAccountLink({
      to: user.email,
      url,
      purpose: "verify-email",
      ...verificationEmail(user.name, url),
    });
    return NextResponse.json({ ok: true });
  }
);
