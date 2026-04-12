import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import type Database from "better-sqlite3";
type DbConnection = Database.Database;
import type {
  Contact,
  Deal,
  DealStage,
  Email,
  EmailCategory,
  EmailPriority,
  FollowUp,
  PlanTier,
  Session,
  StoreShape,
  SubscriptionStatus,
  User,
} from "./types";
import { LEGACY_STAGE_MAP } from "./types";
import { closeConnection, getConnection } from "./db";
import { seedStore } from "./seed";

// SQLite-backed store. Every user-owned table carries a `userId` foreign
// key so multiple accounts can share one DB file. Every exported query
// takes a `userId` as its first argument and scopes its SELECT/INSERT
// accordingly — there is no implicit "current user" context inside the
// store module. Call sites read the current user from cookies and pass
// the id in explicitly. This keeps the scoping boundary auditable.
//
// The DB file lives at ./data/store.sqlite. On first boot we create all
// tables (and, for pre-auth installs, migrate existing rows onto a legacy
// owner user — see migrateLegacyData).
//
// Connection management (open/close/cache) lives in ./db so this file
// stays focused on schema + queries. See docs/postgres-migration.md.

function db(): DbConnection {
  return getConnection({
    onOpen: (conn) => {
      conn.pragma("journal_mode = WAL");
      conn.pragma("foreign_keys = ON");
      migrate(conn);
    },
  });
}

/**
 * Test hook: close the cached connection so the next db() call reopens
 * against whatever SMB_AI_OPS_DATA_DIR currently points at. Not exported
 * through a public entry point — tests reach in for this.
 */
export function __resetDbForTests(): void {
  closeConnection();
}

function migrate(conn: Database.Database): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      email          TEXT NOT NULL COLLATE NOCASE,
      passwordHash   TEXT NOT NULL,
      name           TEXT NOT NULL,
      inboundAddress TEXT COLLATE NOCASE,
      createdAt      TEXT NOT NULL,
      updatedAt      TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_inbound
      ON users(inboundAddress) WHERE inboundAddress IS NOT NULL;

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      userId     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      createdAt  TEXT NOT NULL,
      expiresAt  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          TEXT PRIMARY KEY,
      userId      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tokenHash   TEXT NOT NULL,
      createdAt   TEXT NOT NULL,
      expiresAt   TEXT NOT NULL,
      usedAt      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(userId);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_hash ON password_reset_tokens(tokenHash);

    CREATE TABLE IF NOT EXISTS jobs (
      id          TEXT PRIMARY KEY,
      userId      TEXT REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      payload     TEXT NOT NULL,
      status      TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      maxAttempts INTEGER NOT NULL DEFAULT 3,
      lastError   TEXT,
      runAfter    TEXT NOT NULL,
      createdAt   TEXT NOT NULL,
      startedAt   TEXT,
      finishedAt  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status_runAfter
      ON jobs(status, runAfter);
    CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(userId);

    CREATE TABLE IF NOT EXISTS contacts (
      id         TEXT PRIMARY KEY,
      userId     TEXT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL COLLATE NOCASE,
      company    TEXT,
      phone      TEXT,
      notes      TEXT,
      createdAt  TEXT NOT NULL,
      updatedAt  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(userId);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_email
      ON contacts(userId, email);

    CREATE TABLE IF NOT EXISTS deals (
      id             TEXT PRIMARY KEY,
      userId         TEXT,
      title          TEXT NOT NULL,
      contactId      TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      stage          TEXT NOT NULL,
      amount         REAL NOT NULL DEFAULT 0,
      currency       TEXT NOT NULL DEFAULT 'USD',
      nextStep       TEXT,
      lastActivityAt TEXT NOT NULL,
      createdAt      TEXT NOT NULL,
      updatedAt      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_deals_user ON deals(userId);
    CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contactId);
    CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);

    CREATE TABLE IF NOT EXISTS emails (
      id          TEXT PRIMARY KEY,
      userId      TEXT,
      fromAddr    TEXT NOT NULL,
      fromName    TEXT,
      toAddr      TEXT NOT NULL,
      subject     TEXT NOT NULL,
      body        TEXT NOT NULL,
      receivedAt  TEXT NOT NULL,
      processed   INTEGER NOT NULL DEFAULT 0,
      category    TEXT,
      priority    TEXT,
      summary     TEXT,
      contactId   TEXT,
      dealId      TEXT,
      followUpId  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(userId);
    CREATE INDEX IF NOT EXISTS idx_emails_processed ON emails(processed);
    CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(receivedAt);

    CREATE TABLE IF NOT EXISTS followUps (
      id            TEXT PRIMARY KEY,
      userId        TEXT,
      emailId       TEXT,
      dealId        TEXT,
      contactId     TEXT NOT NULL,
      subject       TEXT NOT NULL,
      draft         TEXT NOT NULL,
      reason        TEXT NOT NULL,
      status        TEXT NOT NULL,
      createdAt     TEXT NOT NULL,
      scheduledFor  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_followups_user ON followUps(userId);
    CREATE INDEX IF NOT EXISTS idx_followups_status ON followUps(status);

    CREATE TABLE IF NOT EXISTS ai_usage (
      id                  TEXT PRIMARY KEY,
      userId              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind                TEXT NOT NULL,
      model               TEXT NOT NULL,
      inputTokens         INTEGER NOT NULL DEFAULT 0,
      outputTokens        INTEGER NOT NULL DEFAULT 0,
      cachedInputTokens   INTEGER NOT NULL DEFAULT 0,
      cacheCreationTokens INTEGER NOT NULL DEFAULT 0,
      estimatedCostUsd    REAL NOT NULL DEFAULT 0,
      createdAt           TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created
      ON ai_usage(userId, createdAt);
  `);

  // Incremental column adds for existing installs that predate the userId
  // scoping. SQLite has no "ADD COLUMN IF NOT EXISTS" so we inspect
  // pragma table_info first.
  addColumnIfMissing(conn, "contacts", "userId", "TEXT");
  addColumnIfMissing(conn, "deals", "userId", "TEXT");
  addColumnIfMissing(conn, "emails", "userId", "TEXT");
  addColumnIfMissing(conn, "followUps", "userId", "TEXT");
  addColumnIfMissing(conn, "followUps", "sentAt", "TEXT");
  addColumnIfMissing(conn, "followUps", "sentMessageId", "TEXT");
  addColumnIfMissing(conn, "deals", "costMaterials", "REAL DEFAULT 0");
  addColumnIfMissing(conn, "deals", "costLabor", "REAL DEFAULT 0");
  addColumnIfMissing(conn, "users", "aiWeeklyBudgetUsd", "REAL DEFAULT 0");
  addColumnIfMissing(conn, "followUps", "icsData", "TEXT");
  addColumnIfMissing(conn, "users", "stripeCustomerId", "TEXT");
  addColumnIfMissing(conn, "users", "stripeSubscriptionId", "TEXT");
  addColumnIfMissing(conn, "users", "stripePriceId", "TEXT");
  addColumnIfMissing(conn, "users", "subscriptionStatus", "TEXT");
  addColumnIfMissing(conn, "users", "planTier", "TEXT DEFAULT 'free'");
  addColumnIfMissing(conn, "users", "trialEndsAt", "TEXT");

  migrateLegacyStageValues(conn);
  migrateLegacyData(conn);
}

/**
 * Rewrite pre-rename stage strings to the local-service lifecycle.
 * Safe to run on every boot — the UPDATEs only touch rows whose stage
 * value is still one of the legacy names, so re-running is a no-op.
 */
function migrateLegacyStageValues(conn: Database.Database): void {
  const stmt = conn.prepare("UPDATE deals SET stage = ? WHERE stage = ?");
  for (const [oldStage, newStage] of Object.entries(LEGACY_STAGE_MAP)) {
    if (oldStage === newStage) continue;
    stmt.run(newStage, oldStage);
  }
}

function addColumnIfMissing(
  conn: Database.Database,
  table: string,
  column: string,
  type: string
): void {
  const cols = conn
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

// If the DB already has rows from the pre-auth era (contacts exist but
// users is empty), attach them to a freshly-minted "legacy owner" account
// so the new multi-user code has something to scope against. The password
// is printed to the server console exactly once — the operator should log
// in with it and change it. For clean installs this is a no-op.
function migrateLegacyData(conn: Database.Database): void {
  const userCount = (
    conn.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;
  if (userCount > 0) return;

  const hasLegacyRows = (
    conn
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM contacts) +
           (SELECT COUNT(*) FROM deals) +
           (SELECT COUNT(*) FROM emails) +
           (SELECT COUNT(*) FROM followUps) AS total`
      )
      .get() as { total: number }
  ).total;
  if (hasLegacyRows === 0) return;

  // Inline the scrypt hash so this migration doesn't import auth.ts —
  // store.ts is imported from every server entry point (including some
  // that don't transitively load auth.ts yet at the time this runs), so
  // a require cycle here would be hard to reason about. The format is
  // identical to auth.ts's hashPassword output so a log-in with this
  // password against the real verify path just works.
  const tempPassword = randomUUID();
  const salt = randomBytes(16);
  const hash = scryptSync(tempPassword, salt, 64);
  const passwordHash = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;

  const id = randomUUID();
  const nowStr = new Date().toISOString();
  conn
    .prepare(
      `INSERT INTO users (id, email, passwordHash, name, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, "owner@localhost", passwordHash, "Legacy Owner", nowStr, nowStr);

  conn.prepare("UPDATE contacts  SET userId = ? WHERE userId IS NULL").run(id);
  conn.prepare("UPDATE deals     SET userId = ? WHERE userId IS NULL").run(id);
  conn.prepare("UPDATE emails    SET userId = ? WHERE userId IS NULL").run(id);
  conn.prepare("UPDATE followUps SET userId = ? WHERE userId IS NULL").run(id);

  // eslint-disable-next-line no-console
  console.warn(
    `[smb-ai-ops] migrated pre-auth data to user owner@localhost — ` +
      `temporary password: ${tempPassword} (change after first login)`
  );
}

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return randomUUID();
}

// ---------- Row mappers ----------

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  inboundAddress: string | null;
  aiWeeklyBudgetUsd: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  subscriptionStatus: string | null;
  planTier: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    inboundAddress: row.inboundAddress ?? undefined,
    aiWeeklyBudgetUsd: row.aiWeeklyBudgetUsd ?? 0,
    stripeCustomerId: row.stripeCustomerId ?? undefined,
    stripeSubscriptionId: row.stripeSubscriptionId ?? undefined,
    stripePriceId: row.stripePriceId ?? undefined,
    subscriptionStatus: (row.subscriptionStatus as SubscriptionStatus) ?? undefined,
    planTier: (row.planTier as PlanTier) ?? "free",
    trialEndsAt: row.trialEndsAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

interface SessionRow {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

function rowToSession(row: SessionRow): Session {
  return { ...row };
}

interface ContactRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    company: row.company ?? undefined,
    phone: row.phone ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

interface DealRow {
  id: string;
  userId: string;
  title: string;
  contactId: string;
  stage: DealStage;
  amount: number;
  currency: string;
  costMaterials: number;
  costLabor: number;
  nextStep: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

function rowToDeal(row: DealRow): Deal {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    contactId: row.contactId,
    stage: row.stage,
    amount: row.amount,
    currency: row.currency,
    costMaterials: row.costMaterials ?? 0,
    costLabor: row.costLabor ?? 0,
    nextStep: row.nextStep ?? undefined,
    lastActivityAt: row.lastActivityAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

interface EmailRow {
  id: string;
  userId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string;
  subject: string;
  body: string;
  receivedAt: string;
  processed: number;
  category: EmailCategory | null;
  priority: EmailPriority | null;
  summary: string | null;
  contactId: string | null;
  dealId: string | null;
  followUpId: string | null;
}

function rowToEmail(row: EmailRow): Email {
  return {
    id: row.id,
    userId: row.userId,
    from: row.fromAddr,
    fromName: row.fromName ?? undefined,
    to: row.toAddr,
    subject: row.subject,
    body: row.body,
    receivedAt: row.receivedAt,
    processed: row.processed === 1,
    category: row.category ?? undefined,
    priority: row.priority ?? undefined,
    summary: row.summary ?? undefined,
    contactId: row.contactId ?? undefined,
    dealId: row.dealId ?? undefined,
    followUpId: row.followUpId ?? undefined,
  };
}

interface FollowUpRow {
  id: string;
  userId: string;
  emailId: string | null;
  dealId: string | null;
  contactId: string;
  subject: string;
  draft: string;
  reason: string;
  status: FollowUp["status"];
  createdAt: string;
  scheduledFor: string | null;
  sentAt: string | null;
  sentMessageId: string | null;
  icsData: string | null;
}

function rowToFollowUp(row: FollowUpRow): FollowUp {
  return {
    id: row.id,
    userId: row.userId,
    emailId: row.emailId ?? undefined,
    dealId: row.dealId ?? undefined,
    contactId: row.contactId,
    subject: row.subject,
    draft: row.draft,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
    scheduledFor: row.scheduledFor ?? undefined,
    sentAt: row.sentAt ?? undefined,
    sentMessageId: row.sentMessageId ?? undefined,
    icsData: row.icsData ?? undefined,
  };
}

// ---------- Insert helpers (used by seeding + create) ----------

function insertContactRow(conn: Database.Database, c: Contact): void {
  conn
    .prepare(
      `INSERT INTO contacts (id, userId, name, email, company, phone, notes, createdAt, updatedAt)
       VALUES (@id, @userId, @name, @email, @company, @phone, @notes, @createdAt, @updatedAt)`
    )
    .run({
      id: c.id,
      userId: c.userId,
      name: c.name,
      email: c.email,
      company: c.company ?? null,
      phone: c.phone ?? null,
      notes: c.notes ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });
}

function insertDealRow(conn: Database.Database, d: Deal): void {
  conn
    .prepare(
      `INSERT INTO deals (id, userId, title, contactId, stage, amount, currency, costMaterials, costLabor, nextStep, lastActivityAt, createdAt, updatedAt)
       VALUES (@id, @userId, @title, @contactId, @stage, @amount, @currency, @costMaterials, @costLabor, @nextStep, @lastActivityAt, @createdAt, @updatedAt)`
    )
    .run({
      id: d.id,
      userId: d.userId,
      title: d.title,
      contactId: d.contactId,
      stage: d.stage,
      amount: d.amount,
      currency: d.currency,
      costMaterials: d.costMaterials,
      costLabor: d.costLabor,
      nextStep: d.nextStep ?? null,
      lastActivityAt: d.lastActivityAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    });
}

function insertEmailRow(conn: Database.Database, e: Email): void {
  conn
    .prepare(
      `INSERT INTO emails (id, userId, fromAddr, fromName, toAddr, subject, body, receivedAt, processed, category, priority, summary, contactId, dealId, followUpId)
       VALUES (@id, @userId, @fromAddr, @fromName, @toAddr, @subject, @body, @receivedAt, @processed, @category, @priority, @summary, @contactId, @dealId, @followUpId)`
    )
    .run({
      id: e.id,
      userId: e.userId,
      fromAddr: e.from,
      fromName: e.fromName ?? null,
      toAddr: e.to,
      subject: e.subject,
      body: e.body,
      receivedAt: e.receivedAt,
      processed: e.processed ? 1 : 0,
      category: e.category ?? null,
      priority: e.priority ?? null,
      summary: e.summary ?? null,
      contactId: e.contactId ?? null,
      dealId: e.dealId ?? null,
      followUpId: e.followUpId ?? null,
    });
}

function insertFollowUpRow(conn: Database.Database, f: FollowUp): void {
  conn
    .prepare(
      `INSERT INTO followUps (id, userId, emailId, dealId, contactId, subject, draft, reason, status, createdAt, scheduledFor, sentAt, sentMessageId, icsData)
       VALUES (@id, @userId, @emailId, @dealId, @contactId, @subject, @draft, @reason, @status, @createdAt, @scheduledFor, @sentAt, @sentMessageId, @icsData)`
    )
    .run({
      id: f.id,
      userId: f.userId,
      emailId: f.emailId ?? null,
      dealId: f.dealId ?? null,
      contactId: f.contactId,
      subject: f.subject,
      draft: f.draft,
      reason: f.reason,
      status: f.status,
      createdAt: f.createdAt,
      scheduledFor: f.scheduledFor ?? null,
      sentAt: f.sentAt ?? null,
      sentMessageId: f.sentMessageId ?? null,
      icsData: f.icsData ?? null,
    });
}

// ---------- Users ----------

export function createUserRow(input: {
  email: string;
  passwordHash: string;
  name: string;
  inboundAddress?: string;
}): User {
  const conn = db();
  const id = newId();
  const nowStr = now();
  conn
    .prepare(
      `INSERT INTO users (id, email, passwordHash, name, inboundAddress, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.email,
      input.passwordHash,
      input.name,
      input.inboundAddress ?? null,
      nowStr,
      nowStr
    );
  return {
    id,
    email: input.email,
    name: input.name,
    inboundAddress: input.inboundAddress,
    aiWeeklyBudgetUsd: 0,
    planTier: "free" as const,
    createdAt: nowStr,
    updatedAt: nowStr,
  };
}

export function updateUserInboundAddress(
  userId: string,
  inboundAddress: string
): User | undefined {
  const conn = db();
  const nowStr = now();
  const result = conn
    .prepare(
      `UPDATE users SET inboundAddress = ?, updatedAt = ? WHERE id = ?`
    )
    .run(inboundAddress, nowStr, userId);
  if (result.changes === 0) return undefined;
  return getUserById(userId);
}

export function updateUserAiBudget(
  userId: string,
  budgetUsd: number
): User | undefined {
  const conn = db();
  const result = conn
    .prepare(
      `UPDATE users SET aiWeeklyBudgetUsd = ?, updatedAt = ? WHERE id = ?`
    )
    .run(budgetUsd, now(), userId);
  if (result.changes === 0) return undefined;
  return getUserById(userId);
}

export function updateUserStripe(
  userId: string,
  fields: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    subscriptionStatus?: string | null;
    planTier?: PlanTier;
    trialEndsAt?: string;
  }
): User | undefined {
  const conn = db();
  const sets: string[] = ["updatedAt = ?"];
  const vals: unknown[] = [now()];
  if (fields.stripeCustomerId !== undefined) {
    sets.push("stripeCustomerId = ?");
    vals.push(fields.stripeCustomerId);
  }
  if (fields.stripeSubscriptionId !== undefined) {
    sets.push("stripeSubscriptionId = ?");
    vals.push(fields.stripeSubscriptionId);
  }
  if (fields.stripePriceId !== undefined) {
    sets.push("stripePriceId = ?");
    vals.push(fields.stripePriceId);
  }
  if (fields.subscriptionStatus !== undefined) {
    sets.push("subscriptionStatus = ?");
    vals.push(fields.subscriptionStatus);
  }
  if (fields.planTier !== undefined) {
    sets.push("planTier = ?");
    vals.push(fields.planTier);
  }
  if (fields.trialEndsAt !== undefined) {
    sets.push("trialEndsAt = ?");
    vals.push(fields.trialEndsAt);
  }
  vals.push(userId);
  conn.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getUserById(userId);
}

export function getUserByStripeCustomerId(
  stripeCustomerId: string
): User | undefined {
  const row = db()
    .prepare("SELECT * FROM users WHERE stripeCustomerId = ?")
    .get(stripeCustomerId) as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

export function getUserById(userId: string): User | undefined {
  const row = db()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

export function getUserByEmail(email: string): User | undefined {
  const row = db()
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email.trim()) as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

/**
 * Returns the password hash for a user, keyed by email. Kept separate from
 * getUserByEmail so the rest of the app can't accidentally handle hashes.
 */
export function getPasswordHashByEmail(email: string): string | undefined {
  const row = db()
    .prepare("SELECT passwordHash FROM users WHERE email = ? COLLATE NOCASE")
    .get(email.trim()) as { passwordHash: string } | undefined;
  return row?.passwordHash;
}

export function findUserByInboundAddress(address: string): User | undefined {
  const row = db()
    .prepare(
      "SELECT * FROM users WHERE inboundAddress = ? COLLATE NOCASE LIMIT 1"
    )
    .get(address.trim()) as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

export function getFirstUser(): User | undefined {
  const row = db()
    .prepare("SELECT * FROM users ORDER BY createdAt ASC LIMIT 1")
    .get() as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

// Used by the scheduled digest job. Callers iterate over every user and
// run their own per-user work. Never exposed to end-user API routes.
export function listAllUsers(): User[] {
  const rows = db()
    .prepare("SELECT * FROM users ORDER BY createdAt ASC")
    .all() as UserRow[];
  return rows.map(rowToUser);
}

// ---------- Sessions ----------

export function createSessionRow(input: {
  id: string;
  userId: string;
  expiresAt: string;
}): Session {
  const conn = db();
  const createdAt = now();
  conn
    .prepare(
      `INSERT INTO sessions (id, userId, createdAt, expiresAt)
       VALUES (?, ?, ?, ?)`
    )
    .run(input.id, input.userId, createdAt, input.expiresAt);
  return {
    id: input.id,
    userId: input.userId,
    createdAt,
    expiresAt: input.expiresAt,
  };
}

export function getSession(sessionId: string): Session | undefined {
  const row = db()
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  return row ? rowToSession(row) : undefined;
}

export function deleteSession(sessionId: string): void {
  db().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function deleteExpiredSessions(): void {
  db()
    .prepare("DELETE FROM sessions WHERE expiresAt < ?")
    .run(new Date().toISOString());
}

export function deleteSessionsForUser(userId: string): void {
  db().prepare("DELETE FROM sessions WHERE userId = ?").run(userId);
}

// ---------- Password reset tokens ----------

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

interface PasswordResetTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

function rowToPasswordResetToken(
  row: PasswordResetTokenRow
): PasswordResetToken {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt ?? undefined,
  };
}

export function createPasswordResetToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}): PasswordResetToken {
  const conn = db();
  const id = newId();
  const createdAt = now();
  conn
    .prepare(
      `INSERT INTO password_reset_tokens
         (id, userId, tokenHash, createdAt, expiresAt, usedAt)
       VALUES (?, ?, ?, ?, ?, NULL)`
    )
    .run(id, input.userId, input.tokenHash, createdAt, input.expiresAt);
  return {
    id,
    userId: input.userId,
    tokenHash: input.tokenHash,
    createdAt,
    expiresAt: input.expiresAt,
  };
}

export function findPasswordResetToken(
  tokenHash: string
): PasswordResetToken | undefined {
  const row = db()
    .prepare(
      "SELECT * FROM password_reset_tokens WHERE tokenHash = ? LIMIT 1"
    )
    .get(tokenHash) as PasswordResetTokenRow | undefined;
  return row ? rowToPasswordResetToken(row) : undefined;
}

export function markPasswordResetTokenUsed(id: string): void {
  db()
    .prepare("UPDATE password_reset_tokens SET usedAt = ? WHERE id = ?")
    .run(now(), id);
}

export function deleteExpiredPasswordResetTokens(): void {
  db()
    .prepare("DELETE FROM password_reset_tokens WHERE expiresAt < ?")
    .run(now());
}

export function updateUserPasswordHash(
  userId: string,
  passwordHash: string
): void {
  const conn = db();
  conn
    .prepare(
      `UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?`
    )
    .run(passwordHash, now(), userId);
}

// ---------- Jobs ----------

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface Job {
  id: string;
  userId?: string;
  type: string;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  runAfter: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

interface JobRow {
  id: string;
  userId: string | null;
  type: string;
  payload: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  runAfter: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

function rowToJob(row: JobRow): Job {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.payload);
  } catch {
    parsed = null;
  }
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    type: row.type,
    payload: parsed,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError ?? undefined,
    runAfter: row.runAfter,
    createdAt: row.createdAt,
    startedAt: row.startedAt ?? undefined,
    finishedAt: row.finishedAt ?? undefined,
  };
}

export function enqueueJob(input: {
  type: string;
  payload: unknown;
  userId?: string;
  runAfter?: string;
  maxAttempts?: number;
}): Job {
  const conn = db();
  const id = newId();
  const createdAt = now();
  const runAfter = input.runAfter ?? createdAt;
  const maxAttempts = input.maxAttempts ?? 3;
  const payloadText = JSON.stringify(input.payload ?? null);
  conn
    .prepare(
      `INSERT INTO jobs
         (id, userId, type, payload, status, attempts, maxAttempts, lastError, runAfter, createdAt)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, NULL, ?, ?)`
    )
    .run(id, input.userId ?? null, input.type, payloadText, maxAttempts, runAfter, createdAt);
  return {
    id,
    userId: input.userId,
    type: input.type,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    maxAttempts,
    runAfter,
    createdAt,
  };
}

/**
 * Atomically claim the next runnable job — a single SQL UPDATE flips one
 * row from pending->running and returns it. better-sqlite3 is synchronous
 * and single-threaded within a process, so the UPDATE is serial-safe for
 * a single-worker deployment. Multiple workers would need a real
 * queueing backend.
 */
export function claimNextJob(): Job | undefined {
  const conn = db();
  const nowStr = now();
  const row = conn
    .prepare(
      `SELECT * FROM jobs
        WHERE status = 'pending' AND runAfter <= ?
        ORDER BY runAfter ASC
        LIMIT 1`
    )
    .get(nowStr) as JobRow | undefined;
  if (!row) return undefined;

  const update = conn
    .prepare(
      `UPDATE jobs
          SET status = 'running', startedAt = ?, attempts = attempts + 1
        WHERE id = ? AND status = 'pending'`
    )
    .run(nowStr, row.id);

  if (update.changes !== 1) return undefined; // raced — try again next tick

  row.status = "running";
  row.startedAt = nowStr;
  row.attempts = row.attempts + 1;
  return rowToJob(row);
}

export function completeJob(id: string): void {
  db()
    .prepare(
      `UPDATE jobs SET status = 'done', finishedAt = ?, lastError = NULL WHERE id = ?`
    )
    .run(now(), id);
}

export function failJob(id: string, message: string): void {
  const conn = db();
  const row = conn
    .prepare("SELECT attempts, maxAttempts FROM jobs WHERE id = ?")
    .get(id) as { attempts: number; maxAttempts: number } | undefined;
  if (!row) return;

  if (row.attempts >= row.maxAttempts) {
    conn
      .prepare(
        `UPDATE jobs SET status = 'failed', finishedAt = ?, lastError = ? WHERE id = ?`
      )
      .run(now(), message, id);
  } else {
    // Exponential backoff: 30s, 2m, 8m, 32m, capped at 1h.
    const delayMs = Math.min(30_000 * Math.pow(4, row.attempts - 1), 3_600_000);
    const runAfter = new Date(Date.now() + delayMs).toISOString();
    conn
      .prepare(
        `UPDATE jobs SET status = 'pending', runAfter = ?, lastError = ? WHERE id = ?`
      )
      .run(runAfter, message, id);
  }
}

export function countPendingJobs(): number {
  const row = db()
    .prepare(
      "SELECT COUNT(*) AS c FROM jobs WHERE status IN ('pending', 'running')"
    )
    .get() as { c: number };
  return row.c;
}

export function listRecentJobs(limit = 50): Job[] {
  const rows = db()
    .prepare(
      "SELECT * FROM jobs ORDER BY createdAt DESC LIMIT ?"
    )
    .all(limit) as JobRow[];
  return rows.map(rowToJob);
}

// ---------- Contacts ----------

export function listContacts(userId: string): Contact[] {
  const rows = db()
    .prepare(
      "SELECT * FROM contacts WHERE userId = ? ORDER BY name COLLATE NOCASE ASC"
    )
    .all(userId) as ContactRow[];
  return rows.map(rowToContact);
}

export function getContact(
  userId: string,
  contactId: string
): Contact | undefined {
  const row = db()
    .prepare("SELECT * FROM contacts WHERE id = ? AND userId = ?")
    .get(contactId, userId) as ContactRow | undefined;
  return row ? rowToContact(row) : undefined;
}

export function findContactByEmail(
  userId: string,
  email: string
): Contact | undefined {
  const row = db()
    .prepare(
      "SELECT * FROM contacts WHERE userId = ? AND email = ? COLLATE NOCASE LIMIT 1"
    )
    .get(userId, email.trim()) as ContactRow | undefined;
  return row ? rowToContact(row) : undefined;
}

export function upsertContact(
  userId: string,
  input: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
    notes?: string;
  }
): Contact {
  const conn = db();
  const nowStr = now();
  // Race-safe upsert on (userId, email). When the row already exists,
  // COALESCE the incoming fields onto the existing ones so we don't wipe
  // data on partial updates.
  conn
    .prepare(
      `INSERT INTO contacts (id, userId, name, email, company, phone, notes, createdAt, updatedAt)
       VALUES (@id, @userId, @name, @email, @company, @phone, @notes, @createdAt, @updatedAt)
       ON CONFLICT(userId, email) DO UPDATE SET
         name      = CASE WHEN excluded.name  != '' THEN excluded.name  ELSE contacts.name  END,
         company   = COALESCE(excluded.company, contacts.company),
         phone     = COALESCE(excluded.phone,   contacts.phone),
         notes     = COALESCE(excluded.notes,   contacts.notes),
         updatedAt = excluded.updatedAt`
    )
    .run({
      id: newId(),
      userId,
      name: input.name,
      email: input.email,
      company: input.company ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      createdAt: nowStr,
      updatedAt: nowStr,
    });

  const row = conn
    .prepare(
      "SELECT * FROM contacts WHERE userId = ? AND email = ? COLLATE NOCASE"
    )
    .get(userId, input.email) as ContactRow;
  return rowToContact(row);
}

// ---------- Deals ----------

export function listDeals(userId: string): Deal[] {
  const rows = db()
    .prepare("SELECT * FROM deals WHERE userId = ? ORDER BY lastActivityAt DESC")
    .all(userId) as DealRow[];
  return rows.map(rowToDeal);
}

export function getDeal(userId: string, dealId: string): Deal | undefined {
  const row = db()
    .prepare("SELECT * FROM deals WHERE id = ? AND userId = ?")
    .get(dealId, userId) as DealRow | undefined;
  return row ? rowToDeal(row) : undefined;
}

export function findOpenDealForContact(
  userId: string,
  contactId: string
): Deal | undefined {
  const row = db()
    .prepare(
      `SELECT * FROM deals
       WHERE userId = ? AND contactId = ? AND stage NOT IN ('completed', 'lost')
       ORDER BY lastActivityAt DESC
       LIMIT 1`
    )
    .get(userId, contactId) as DealRow | undefined;
  return row ? rowToDeal(row) : undefined;
}

export function listDealsForContact(
  userId: string,
  contactId: string
): Deal[] {
  const rows = db()
    .prepare(
      `SELECT * FROM deals
       WHERE userId = ? AND contactId = ?
       ORDER BY lastActivityAt DESC`
    )
    .all(userId, contactId) as DealRow[];
  return rows.map(rowToDeal);
}

export function createDeal(
  userId: string,
  input: {
    title: string;
    contactId: string;
    stage?: DealStage;
    amount?: number;
    currency?: string;
    costMaterials?: number;
    costLabor?: number;
    nextStep?: string;
  }
): Deal {
  const deal: Deal = {
    id: newId(),
    userId,
    title: input.title,
    contactId: input.contactId,
    stage: input.stage ?? "inquiry",
    amount: input.amount ?? 0,
    currency: input.currency ?? "USD",
    costMaterials: input.costMaterials ?? 0,
    costLabor: input.costLabor ?? 0,
    nextStep: input.nextStep,
    lastActivityAt: now(),
    createdAt: now(),
    updatedAt: now(),
  };
  insertDealRow(db(), deal);
  return deal;
}

export function updateDeal(
  userId: string,
  dealId: string,
  patch: Partial<Omit<Deal, "id" | "userId" | "createdAt">>
): Deal | undefined {
  const conn = db();
  const existing = conn
    .prepare("SELECT * FROM deals WHERE id = ? AND userId = ?")
    .get(dealId, userId) as DealRow | undefined;
  if (!existing) return undefined;

  const nowStr = now();
  const lastActivityAt = patch.lastActivityAt ?? nowStr;
  const next: DealRow = {
    id: existing.id,
    userId: existing.userId,
    title: patch.title ?? existing.title,
    contactId: patch.contactId ?? existing.contactId,
    stage: patch.stage ?? existing.stage,
    amount: patch.amount ?? existing.amount,
    currency: patch.currency ?? existing.currency,
    costMaterials: patch.costMaterials ?? existing.costMaterials,
    costLabor: patch.costLabor ?? existing.costLabor,
    nextStep: patch.nextStep ?? existing.nextStep,
    lastActivityAt,
    createdAt: existing.createdAt,
    updatedAt: nowStr,
  };

  conn
    .prepare(
      `UPDATE deals SET
         title = @title,
         contactId = @contactId,
         stage = @stage,
         amount = @amount,
         currency = @currency,
         costMaterials = @costMaterials,
         costLabor = @costLabor,
         nextStep = @nextStep,
         lastActivityAt = @lastActivityAt,
         updatedAt = @updatedAt
       WHERE id = @id AND userId = @userId`
    )
    .run({
      id: next.id,
      userId: next.userId,
      title: next.title,
      contactId: next.contactId,
      stage: next.stage,
      amount: next.amount,
      currency: next.currency,
      costMaterials: next.costMaterials,
      costLabor: next.costLabor,
      nextStep: next.nextStep ?? null,
      lastActivityAt: next.lastActivityAt,
      updatedAt: next.updatedAt,
    });

  return rowToDeal(next);
}

// ---------- Emails ----------

export function listEmails(userId: string): Email[] {
  const rows = db()
    .prepare("SELECT * FROM emails WHERE userId = ? ORDER BY receivedAt DESC")
    .all(userId) as EmailRow[];
  return rows.map(rowToEmail);
}

export function getEmail(userId: string, emailId: string): Email | undefined {
  const row = db()
    .prepare("SELECT * FROM emails WHERE id = ? AND userId = ?")
    .get(emailId, userId) as EmailRow | undefined;
  return row ? rowToEmail(row) : undefined;
}

export function listEmailsForContact(
  userId: string,
  contactId: string
): Email[] {
  const rows = db()
    .prepare(
      `SELECT * FROM emails
       WHERE userId = ? AND contactId = ?
       ORDER BY receivedAt DESC`
    )
    .all(userId, contactId) as EmailRow[];
  return rows.map(rowToEmail);
}

export function listEmailsForDeal(
  userId: string,
  dealId: string
): Email[] {
  const rows = db()
    .prepare(
      `SELECT * FROM emails
       WHERE userId = ? AND dealId = ?
       ORDER BY receivedAt DESC`
    )
    .all(userId, dealId) as EmailRow[];
  return rows.map(rowToEmail);
}

export function createEmail(
  userId: string,
  input: {
    from: string;
    fromName?: string;
    to: string;
    subject: string;
    body: string;
    receivedAt?: string;
  }
): Email {
  const email: Email = {
    id: newId(),
    userId,
    from: input.from,
    fromName: input.fromName,
    to: input.to,
    subject: input.subject,
    body: input.body,
    receivedAt: input.receivedAt ?? now(),
    processed: false,
  };
  insertEmailRow(db(), email);
  return email;
}

export function updateEmail(
  userId: string,
  emailId: string,
  patch: Partial<Omit<Email, "id" | "userId">>
): Email | undefined {
  const conn = db();
  const existing = conn
    .prepare("SELECT * FROM emails WHERE id = ? AND userId = ?")
    .get(emailId, userId) as EmailRow | undefined;
  if (!existing) return undefined;

  const next: EmailRow = {
    id: existing.id,
    userId: existing.userId,
    fromAddr: patch.from ?? existing.fromAddr,
    fromName:
      patch.fromName !== undefined ? patch.fromName ?? null : existing.fromName,
    toAddr: patch.to ?? existing.toAddr,
    subject: patch.subject ?? existing.subject,
    body: patch.body ?? existing.body,
    receivedAt: patch.receivedAt ?? existing.receivedAt,
    processed:
      patch.processed !== undefined
        ? patch.processed
          ? 1
          : 0
        : existing.processed,
    category:
      patch.category !== undefined ? patch.category ?? null : existing.category,
    priority:
      patch.priority !== undefined ? patch.priority ?? null : existing.priority,
    summary:
      patch.summary !== undefined ? patch.summary ?? null : existing.summary,
    contactId:
      patch.contactId !== undefined
        ? patch.contactId ?? null
        : existing.contactId,
    dealId:
      patch.dealId !== undefined ? patch.dealId ?? null : existing.dealId,
    followUpId:
      patch.followUpId !== undefined
        ? patch.followUpId ?? null
        : existing.followUpId,
  };

  conn
    .prepare(
      `UPDATE emails SET
         fromAddr = @fromAddr,
         fromName = @fromName,
         toAddr = @toAddr,
         subject = @subject,
         body = @body,
         receivedAt = @receivedAt,
         processed = @processed,
         category = @category,
         priority = @priority,
         summary = @summary,
         contactId = @contactId,
         dealId = @dealId,
         followUpId = @followUpId
       WHERE id = @id AND userId = @userId`
    )
    .run(next);

  return rowToEmail(next);
}

// ---------- Follow-ups ----------

export function listFollowUps(userId: string): FollowUp[] {
  const rows = db()
    .prepare("SELECT * FROM followUps WHERE userId = ? ORDER BY createdAt DESC")
    .all(userId) as FollowUpRow[];
  return rows.map(rowToFollowUp);
}

export function getFollowUp(
  userId: string,
  followUpId: string
): FollowUp | undefined {
  const row = db()
    .prepare("SELECT * FROM followUps WHERE id = ? AND userId = ?")
    .get(followUpId, userId) as FollowUpRow | undefined;
  return row ? rowToFollowUp(row) : undefined;
}

export function listFollowUpsForContact(
  userId: string,
  contactId: string
): FollowUp[] {
  const rows = db()
    .prepare(
      `SELECT * FROM followUps
       WHERE userId = ? AND contactId = ?
       ORDER BY createdAt DESC`
    )
    .all(userId, contactId) as FollowUpRow[];
  return rows.map(rowToFollowUp);
}

export function findFollowUpBySentMessageId(
  userId: string,
  messageId: string
): FollowUp | undefined {
  const row = db()
    .prepare(
      "SELECT * FROM followUps WHERE userId = ? AND sentMessageId = ?"
    )
    .get(userId, messageId) as FollowUpRow | undefined;
  return row ? rowToFollowUp(row) : undefined;
}

export function listFollowUpsForDeal(
  userId: string,
  dealId: string
): FollowUp[] {
  const rows = db()
    .prepare(
      `SELECT * FROM followUps
       WHERE userId = ? AND dealId = ?
       ORDER BY createdAt DESC`
    )
    .all(userId, dealId) as FollowUpRow[];
  return rows.map(rowToFollowUp);
}

export function createFollowUp(
  userId: string,
  input: {
    contactId: string;
    emailId?: string;
    dealId?: string;
    subject: string;
    draft: string;
    reason: string;
    scheduledFor?: string;
    icsData?: string;
  }
): FollowUp {
  const followUp: FollowUp = {
    id: newId(),
    userId,
    contactId: input.contactId,
    emailId: input.emailId,
    dealId: input.dealId,
    subject: input.subject,
    draft: input.draft,
    reason: input.reason,
    status: "draft",
    createdAt: now(),
    scheduledFor: input.scheduledFor,
    icsData: input.icsData,
  };
  insertFollowUpRow(db(), followUp);
  return followUp;
}

export function updateFollowUp(
  userId: string,
  followUpId: string,
  patch: Partial<Omit<FollowUp, "id" | "userId" | "createdAt">>
): FollowUp | undefined {
  const conn = db();
  const existing = conn
    .prepare("SELECT * FROM followUps WHERE id = ? AND userId = ?")
    .get(followUpId, userId) as FollowUpRow | undefined;
  if (!existing) return undefined;

  const next: FollowUpRow = {
    id: existing.id,
    userId: existing.userId,
    emailId:
      patch.emailId !== undefined ? patch.emailId ?? null : existing.emailId,
    dealId: patch.dealId !== undefined ? patch.dealId ?? null : existing.dealId,
    contactId: patch.contactId ?? existing.contactId,
    subject: patch.subject ?? existing.subject,
    draft: patch.draft ?? existing.draft,
    reason: patch.reason ?? existing.reason,
    status: patch.status ?? existing.status,
    createdAt: existing.createdAt,
    scheduledFor:
      patch.scheduledFor !== undefined
        ? patch.scheduledFor ?? null
        : existing.scheduledFor,
    sentAt: patch.sentAt !== undefined ? patch.sentAt ?? null : existing.sentAt,
    sentMessageId:
      patch.sentMessageId !== undefined
        ? patch.sentMessageId ?? null
        : existing.sentMessageId,
    icsData:
      patch.icsData !== undefined
        ? patch.icsData ?? null
        : existing.icsData,
  };

  conn
    .prepare(
      `UPDATE followUps SET
         emailId = @emailId,
         dealId = @dealId,
         contactId = @contactId,
         subject = @subject,
         draft = @draft,
         reason = @reason,
         status = @status,
         scheduledFor = @scheduledFor,
         sentAt = @sentAt,
         sentMessageId = @sentMessageId,
         icsData = @icsData
       WHERE id = @id AND userId = @userId`
    )
    .run({
      id: next.id,
      userId: next.userId,
      emailId: next.emailId,
      dealId: next.dealId,
      contactId: next.contactId,
      subject: next.subject,
      draft: next.draft,
      reason: next.reason,
      status: next.status,
      scheduledFor: next.scheduledFor,
      sentAt: next.sentAt,
      sentMessageId: next.sentMessageId,
      icsData: next.icsData,
    });

  return rowToFollowUp(next);
}

// ---------- AI usage ----------

export interface AiUsageRow {
  id: string;
  userId: string;
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheCreationTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export function recordAiUsage(input: {
  userId: string;
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheCreationTokens?: number;
  estimatedCostUsd: number;
}): AiUsageRow {
  const row: AiUsageRow = {
    id: newId(),
    userId: input.userId,
    kind: input.kind,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cachedInputTokens: input.cachedInputTokens ?? 0,
    cacheCreationTokens: input.cacheCreationTokens ?? 0,
    estimatedCostUsd: input.estimatedCostUsd,
    createdAt: now(),
  };
  db()
    .prepare(
      `INSERT INTO ai_usage
         (id, userId, kind, model, inputTokens, outputTokens,
          cachedInputTokens, cacheCreationTokens, estimatedCostUsd, createdAt)
       VALUES (@id, @userId, @kind, @model, @inputTokens, @outputTokens,
               @cachedInputTokens, @cacheCreationTokens, @estimatedCostUsd, @createdAt)`
    )
    .run(row);
  return row;
}

export interface AiUsageSummary {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedInputTokens: number;
  totalCacheCreationTokens: number;
  calls: number;
}

export function sumAiUsageSince(
  userId: string,
  sinceIso: string
): AiUsageSummary {
  const row = db()
    .prepare(
      `SELECT
         COALESCE(SUM(estimatedCostUsd), 0)    AS totalCostUsd,
         COALESCE(SUM(inputTokens), 0)         AS totalInputTokens,
         COALESCE(SUM(outputTokens), 0)        AS totalOutputTokens,
         COALESCE(SUM(cachedInputTokens), 0)   AS totalCachedInputTokens,
         COALESCE(SUM(cacheCreationTokens), 0) AS totalCacheCreationTokens,
         COUNT(*)                              AS calls
       FROM ai_usage
       WHERE userId = ? AND createdAt >= ?`
    )
    .get(userId, sinceIso) as AiUsageSummary;
  return row;
}

export function listAiUsage(userId: string, limit = 100): AiUsageRow[] {
  return db()
    .prepare(
      `SELECT * FROM ai_usage WHERE userId = ?
       ORDER BY createdAt DESC LIMIT ?`
    )
    .all(userId, limit) as AiUsageRow[];
}

// ---------- Workspace seeding + maintenance ----------

/**
 * Load the sample contacts/deals/emails into a user's workspace. Called
 * automatically the first time a user signs up so there's something to
 * click on, and also by `/api/reset` to restore a user to a clean seed.
 */
export function seedWorkspace(userId: string): void {
  const conn = db();
  const seed = seedStore(userId);
  const tx = conn.transaction(() => {
    for (const c of seed.contacts) insertContactRow(conn, c);
    for (const d of seed.deals) insertDealRow(conn, d);
    for (const e of seed.emails) insertEmailRow(conn, e);
    for (const f of seed.followUps) insertFollowUpRow(conn, f);
  });
  tx();
}

export function resetStore(userId: string): StoreShape {
  const conn = db();
  const tx = conn.transaction(() => {
    // Cascade-delete is already wired on deals(contactId); we still nuke
    // dependent rows explicitly so emails/followUps (which don't FK to
    // contacts) don't dangle.
    conn.prepare("DELETE FROM followUps WHERE userId = ?").run(userId);
    conn.prepare("DELETE FROM emails WHERE userId = ?").run(userId);
    conn.prepare("DELETE FROM deals WHERE userId = ?").run(userId);
    conn.prepare("DELETE FROM contacts WHERE userId = ?").run(userId);
  });
  tx();
  seedWorkspace(userId);
  return getSnapshot(userId);
}

export function getSnapshot(userId: string): StoreShape {
  return {
    contacts: listContacts(userId),
    deals: listDeals(userId),
    emails: listEmails(userId),
    followUps: listFollowUps(userId),
  };
}
