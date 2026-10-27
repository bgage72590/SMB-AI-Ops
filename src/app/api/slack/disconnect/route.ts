import { NextResponse } from "next/server";
import { logAudit, setUserSlack } from "@/lib/store";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = apiRoute({}, async (_request, user) => {
  setUserSlack(user.id, null);
  logAudit(user.id, "disconnected", "slack", undefined, "Slack disconnected");
  return NextResponse.json({ ok: true });
});
