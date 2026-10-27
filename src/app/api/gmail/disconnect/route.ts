import { NextResponse } from "next/server";
import { updateUserGmail } from "@/lib/store";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = apiRoute({}, async (_request, user) => {
  updateUserGmail(user.id, {
    gmailAccessToken: null,
    gmailRefreshToken: null,
    gmailConnected: false,
    gmailEmail: null,
  });
  return NextResponse.json({ ok: true });
});
