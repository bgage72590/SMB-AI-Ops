import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { logAudit, setUserSlack } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  setUserSlack(user.id, null);
  logAudit(user.id, "disconnected", "slack", undefined, "Slack disconnected");
  return NextResponse.json({ ok: true });
}
