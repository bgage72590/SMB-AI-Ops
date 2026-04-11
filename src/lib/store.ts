import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import Database from "better-sqlite3";
import type {
  Contact,
  Deal,
  DealStage,
  Email,
  EmailCategory,
  EmailPriority,
  FollowUp,
  Session,
  StoreShape,
  User,
} from "./types";
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

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "store.sqlite");

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const conn = new Database(DB_FILE);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  migrate(conn);
  _db = conn;
  return conn;
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
  `);

  // Incremental column adds for existing installs that predate the userId
  // scoping. SQLite has no "ADD COLUMN IF NOT EXISTS" so we inspect
  // pragma table_info first.
  addColumnIfMissing(conn, "contacts", "userId", "TEXT");
  addColumnIfMissing(conn, "deals", "userId", "TEXT");
  addColumnIfMissing(conn, "emails", "userId", "TEXT");
  addColumnIfMissing(conn, "followUps", "userId", "TEXT");

  migrateLegacyData(conn);
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
  createdAt: string;
  updatedAt: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    inboundAddress: row.inboundAddress ?? undefined,
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
      `INSERT INTO deals (id, userId, title, contactId, stage, amount, currency, nextStep, lastActivityAt, createdAt, updatedAt)
       VALUES (@id, @userId, @title, @contactId, @stage, @amount, @currency, @nextStep, @lastActivityAt, @createdAt, @updatedAt)`
    )
    .run({
      id: d.id,
      userId: d.userId,
      title: d.title,
      contactId: d.contactId,
      stage: d.stage,
      amount: d.amount,
      currency: d.currency,
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
      `INSERT INTO followUps (id, userId, emailId, dealId, contactId, subject, draft, reason, status, createdAt, scheduledFor)
       VALUES (@id, @userId, @emailId, @dealId, @contactId, @subject, @draft, @reason, @status, @createdAt, @scheduledFor)`
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
    });
}

// ---------- Users ----------

export function createUserRow(input: {
  email: string;
  passwordHash: string;
  name: string;
}): User {
  const conn = db();
  const id = newId();
  const nowStr = now();
  conn
    .prepare(
      `INSERT INTO users (id, email, passwordHash, name, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.email, input.passwordHash, input.name, nowStr, nowStr);
  return {
    id,
    email: input.email,
    name: input.name,
    createdAt: nowStr,
    updatedAt: nowStr,
  };
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
       WHERE userId = ? AND contactId = ? AND stage NOT IN ('won', 'lost')
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
    nextStep?: string;
  }
): Deal {
  const deal: Deal = {
    id: newId(),
    userId,
    title: input.title,
    contactId: input.contactId,
    stage: input.stage ?? "lead",
    amount: input.amount ?? 0,
    currency: input.currency ?? "USD",
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
         scheduledFor = @scheduledFor
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
    });

  return rowToFollowUp(next);
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
