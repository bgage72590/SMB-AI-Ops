import { NextResponse } from "next/server";
import { updateUserOutlook } from "@/lib/store";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = apiRoute({}, async (_request, user) => {
  updateUserOutlook(user.id, {
    outlookAccessToken: null,
    outlookRefreshToken: null,
    outlookConnected: false,
    outlookEmail: null,
  });
  return NextResponse.json({ ok: true });
});
