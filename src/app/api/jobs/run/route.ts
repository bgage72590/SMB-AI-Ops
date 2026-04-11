import { NextResponse } from "next/server";
import { runJobs } from "@/lib/jobs";
import { verifyCronSecret } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Drain the background job queue. Designed to be poked every 60 seconds
 * by a scheduler (Vercel cron, uptimerobot, a Cloudflare Worker, etc.)
 * so long-running work doesn't block request handlers.
 *
 * Each call processes at most ~10 jobs or runs for 50 seconds, whichever
 * comes first, leaving headroom under serverless platform timeouts.
 *
 * Example vercel.json entry:
 *   { "path": "/api/jobs/run", "schedule": "* * * * *" }
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
