// Postgres connection and migration module. This is the counterpart to db.ts
// (which manages SQLite). When DATABASE_URL is set, the app can use Postgres
// as its backing store instead of SQLite.
//
// This module is NOT active by default — it's imported only when:
//   1. DATABASE_URL is set in the environment
//   2. instrumentation.ts calls migrate() on boot
//
// See docs/postgres-migration.md for the full swap plan.
//
// Driver: postgres.js (porsager/postgres) — tagged-template SQL, built-in
// pooling, zero boilerplate transactions.

import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function getPostgresConnection(): ReturnType<typeof postgres> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Cannot create Postgres connection.");
  }
  _sql = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return _sql;
}

export async function closePostgresConnection(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}

/**
 * Run the full idempotent schema migration against Postgres. Safe to call
 * on every boot — every statement uses IF NOT EXISTS.
 *
 * Uses CITEXT for case-insensitive email columns as recommended in
 * docs/postgres-migration.md.
 */
export async function migratePostgres(): Promise<void> {
  const sql = getPostgresConnection();

  await sql`CREATE EXTENSION IF NOT EXISTS citext`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id               TEXT PRIMARY KEY,
      email            CITEXT NOT NULL,
      "passwordHash"   TEXT NOT NULL,
      name             TEXT NOT NULL,
      "inboundAddress"         CITEXT,
      "aiWeeklyBudgetUsd"      REAL DEFAULT 0,
      "stripeCustomerId"       TEXT,
      "stripeSubscriptionId"   TEXT,
      "stripePriceId"          TEXT,
      "subscriptionStatus"     TEXT,
      "planTier"               TEXT DEFAULT 'free',
      "trialEndsAt"            TEXT,
      "googleAccessToken"      TEXT,
      "googleRefreshToken"     TEXT,
      "googleCalendarEnabled"  INTEGER DEFAULT 0,
      "workspaceId"            TEXT,
      "createdAt"      TEXT NOT NULL,
      "updatedAt"      TEXT NOT NULL
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_inbound ON users("inboundAddress") WHERE "inboundAddress" IS NOT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions("expiresAt")`;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          TEXT PRIMARY KEY,
      "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "tokenHash" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL,
      "usedAt"    TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens("userId")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_hash ON password_reset_tokens("tokenHash")`;

  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id            TEXT PRIMARY KEY,
      "userId"      TEXT REFERENCES users(id) ON DELETE CASCADE,
      type          TEXT NOT NULL,
      payload       TEXT NOT NULL,
      status        TEXT NOT NULL,
      attempts      INTEGER NOT NULL DEFAULT 0,
      "maxAttempts" INTEGER NOT NULL DEFAULT 3,
      "lastError"   TEXT,
      "runAfter"    TEXT NOT NULL,
      "createdAt"   TEXT NOT NULL,
      "startedAt"   TEXT,
      "finishedAt"  TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_status_run ON jobs(status, "runAfter")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs("userId")`;

  await sql`
    CREATE TABLE IF NOT EXISTS contacts (
      id          TEXT PRIMARY KEY,
      "userId"    TEXT,
      name        TEXT NOT NULL,
      email       CITEXT NOT NULL,
      company     TEXT,
      phone       TEXT,
      notes       TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts("userId")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts("userId", email)`;

  await sql`
    CREATE TABLE IF NOT EXISTS deals (
      id               TEXT PRIMARY KEY,
      "userId"         TEXT,
      title            TEXT NOT NULL,
      "contactId"      TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      stage            TEXT NOT NULL,
      amount           REAL NOT NULL DEFAULT 0,
      currency         TEXT NOT NULL DEFAULT 'USD',
      "costMaterials"  REAL DEFAULT 0,
      "costLabor"      REAL DEFAULT 0,
      "nextStep"       TEXT,
      "lastActivityAt" TEXT NOT NULL,
      "createdAt"      TEXT NOT NULL,
      "updatedAt"      TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_deals_user ON deals("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals("contactId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage)`;

  await sql`
    CREATE TABLE IF NOT EXISTS emails (
      id           TEXT PRIMARY KEY,
      "userId"     TEXT,
      "fromAddr"   TEXT NOT NULL,
      "fromName"   TEXT,
      "toAddr"     TEXT NOT NULL,
      subject      TEXT NOT NULL,
      body         TEXT NOT NULL,
      "receivedAt" TEXT NOT NULL,
      processed    INTEGER NOT NULL DEFAULT 0,
      category     TEXT,
      priority     TEXT,
      summary      TEXT,
      "contactId"  TEXT,
      "dealId"     TEXT,
      "followUpId" TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_emails_user ON emails("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emails_processed ON emails(processed)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emails_received ON emails("receivedAt")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "followUps" (
      id             TEXT PRIMARY KEY,
      "userId"       TEXT,
      "emailId"      TEXT,
      "dealId"       TEXT,
      "contactId"    TEXT NOT NULL,
      subject        TEXT NOT NULL,
      draft          TEXT NOT NULL,
      reason         TEXT NOT NULL,
      status         TEXT NOT NULL,
      channel        TEXT DEFAULT 'email',
      "createdAt"    TEXT NOT NULL,
      "scheduledFor" TEXT,
      "sentAt"       TEXT,
      "sentMessageId" TEXT,
      "icsData"      TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_followups_user ON "followUps"("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_followups_status ON "followUps"(status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id                    TEXT PRIMARY KEY,
      "userId"              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind                  TEXT NOT NULL,
      model                 TEXT NOT NULL,
      "inputTokens"         INTEGER NOT NULL DEFAULT 0,
      "outputTokens"        INTEGER NOT NULL DEFAULT 0,
      "cachedInputTokens"   INTEGER NOT NULL DEFAULT 0,
      "cacheCreationTokens" INTEGER NOT NULL DEFAULT 0,
      "estimatedCostUsd"    REAL NOT NULL DEFAULT 0,
      "createdAt"           TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage("userId", "createdAt")`;

  await sql`
    CREATE TABLE IF NOT EXISTS sender_blocklist (
      id          TEXT PRIMARY KEY,
      "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pattern     CITEXT NOT NULL,
      reason      TEXT,
      "createdAt" TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_blocklist_user ON sender_blocklist("userId")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_blocklist_user_pattern ON sender_blocklist("userId", pattern)`;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id           TEXT PRIMARY KEY,
      "userId"     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action       TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId"   TEXT,
      detail       TEXT,
      "createdAt"  TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_log("userId", "createdAt")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log("entityType", "entityId")`;

  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      "ownerId"   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspace_invites (
      id            TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      email         CITEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'member',
      "invitedBy"   TEXT NOT NULL REFERENCES users(id),
      "acceptedAt"  TEXT,
      "createdAt"   TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ws_invites_workspace ON workspace_invites("workspaceId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ws_invites_email ON workspace_invites(email)`;
}
