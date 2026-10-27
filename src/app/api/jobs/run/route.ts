import { NextResponse } from "next/server";
import { runJobs } from "@/lib/jobs";
import { verifyCronSecret } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Drain the background job queue. The in-process scheduler
 * (src/lib/scheduler.ts) does this every minute; this route is a manual
 * trigger: `Authorization: Bearer $CRON_SECRET`.
 *
 * Each call processes at most ~10 jobs or runs for 50 seconds, whichever
 * comes first.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const max = Number(url.searchParams.get("max")) || undefined;
  const result = await runJobs({ max });
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
