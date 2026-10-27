import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { isBackupConfigured, runBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nightly cron that backs up the SQLite database to S3.
 *
 * Runs automatically from the in-process scheduler (src/lib/scheduler.ts).
 * This route is a manual trigger: `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isBackupConfigured()) {
    return NextResponse.json(
      { error: "backup_not_configured", message: "Set BACKUP_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY." },
      { status: 412 }
    );
  }

  const result = await runBackup();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: Request) {
  return POST(request);
}
