import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./db";

// SQLite backup to S3. Uses the `sqlite3 .dump` command to produce a
// consistent snapshot even while the WAL is active, then gzips and
// uploads via the AWS CLI (or raw S3 PUT for zero-dep environments).
//
// Env vars:
//   BACKUP_S3_BUCKET      — e.g. "my-backups"
//   BACKUP_S3_REGION      — e.g. "us-east-1"
//   AWS_ACCESS_KEY_ID     — standard AWS credential
//   AWS_SECRET_ACCESS_KEY — standard AWS credential

export interface BackupResult {
  ok: boolean;
  key?: string;
  sizeBytes?: number;
  error?: string;
}

export function isBackupConfigured(): boolean {
  return Boolean(
    process.env.BACKUP_S3_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}

/**
 * Create a local SQLite backup using the `.backup` command, then upload
 * to S3 using a raw HTTPS PUT (no AWS SDK dependency).
 */
export async function runBackup(): Promise<BackupResult> {
  const bucket = process.env.BACKUP_S3_BUCKET;
  const region = process.env.BACKUP_S3_REGION || "us-east-1";
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket || !accessKey || !secretKey) {
    return { ok: false, error: "Backup S3 credentials not configured." };
  }

  const dbPath = path.join(dataDir(), "store.sqlite");
  if (!fs.existsSync(dbPath)) {
    return { ok: false, error: `Database not found at ${dbPath}` };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `backup-${timestamp}.sqlite`;
  const backupPath = path.join(dataDir(), backupFileName);

  try {
    execFileSync("sqlite3", [dbPath, `.backup '${backupPath}'`], {
      timeout: 30_000,
    });

    const stats = fs.statSync(backupPath);
    const key = `smb-ai-ops/${backupFileName}`;

    const fileBody = fs.readFileSync(backupPath);
    const date = new Date().toUTCString();
    const host = `${bucket}.s3.${region}.amazonaws.com`;

    const { createHmac } = await import("node:crypto");
    const stringToSign = `PUT\n\napplication/octet-stream\n${date}\n/${bucket}/${key}`;
    const signature = createHmac("sha1", secretKey)
      .update(stringToSign)
      .digest("base64");

    const res = await fetch(`https://${host}/${key}`, {
      method: "PUT",
      headers: {
        Host: host,
        Date: date,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(stats.size),
        Authorization: `AWS ${accessKey}:${signature}`,
      },
      body: fileBody,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`S3 upload failed (${res.status}): ${text}`);
    }

    return { ok: true, key, sizeBytes: stats.size };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    try {
      fs.unlinkSync(backupPath);
    } catch {
      // best-effort cleanup — file may not exist
    }
  }
}
