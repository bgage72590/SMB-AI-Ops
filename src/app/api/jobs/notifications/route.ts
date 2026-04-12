import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { runNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runNotifications();
  return NextResponse.json(result);
}
