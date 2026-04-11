import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  Contact,
  Deal,
  DealStage,
  Email,
  EmailCategory,
  EmailPriority,
  FollowUp,
  StoreShape,
} from "./types";
import { seedStore } from "./seed";

// SQLite-backed store. The exported API is identical to the previous JSON
// implementation so call sites don't need to change. The big wins over the
// JSON file:
//   - writes are atomic (single process) / coordinated (WAL mode)
//   - upserts are race-safe via ON CONFLICT
//   - we stop reading the entire world on every request
//
// The DB file lives at ./data/store.sqlite. On first boot we run migrations
// and — if the DB is empty — load the sample data from seed.ts so the app
// is interactive out of the box.

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
  maybeSeed(conn);
  _db = conn;
  return conn;
}

function migrate(conn: Database.Database): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL COLLATE NOCASE,
      company    TEXT,
      phone      TEXT,
      notes      TEXT,
      createdAt  TEXT NOT NULL,
      updatedAt  TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

    CREATE TABLE IF NOT EXISTS deals (
      id             TEXT PRIMARY KEY,
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
    CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contactId);
    CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);

    CREATE TABLE IF NOT EXISTS emails (
      id          TEXT PRIMARY KEY,
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
    CREATE INDEX IF NOT EXISTS idx_emails_processed ON emails(processed);
    CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(receivedAt);

    CREATE TABLE IF NOT EXISTS followUps (
      id            TEXT PRIMARY KEY,
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
    CREATE INDEX IF NOT EXISTS idx_followups_status ON followUps(status);
  `);
}

function maybeSeed(conn: Database.Database): void {
  const row = conn
    .prepare("SELECT COUNT(*) AS c FROM contacts")
    .get() as { c: number };
  if (row.c > 0) return;

  const seed = seedStore();
  const tx = conn.transaction(() => {
    for (const c of seed.contacts) insertContactRow(conn, c);
    for (const d of seed.deals) insertDealRow(conn, d);
    for (const e of seed.emails) insertEmailRow(conn, e);
    for (const f of seed.followUps) insertFollowUpRow(conn, f);
  });
  tx();
}

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return randomUUID();
}

// ---------- Row mappers ----------

interface ContactRow {
  id: string;
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
      `INSERT INTO contacts (id, name, email, company, phone, notes, createdAt, updatedAt)
       VALUES (@id, @name, @email, @company, @phone, @notes, @createdAt, @updatedAt)`
    )
    .run({
      id: c.id,
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
      `INSERT INTO deals (id, title, contactId, stage, amount, currency, nextStep, lastActivityAt, createdAt, updatedAt)
       VALUES (@id, @title, @contactId, @stage, @amount, @currency, @nextStep, @lastActivityAt, @createdAt, @updatedAt)`
    )
    .run({
      id: d.id,
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
      `INSERT INTO emails (id, fromAddr, fromName, toAddr, subject, body, receivedAt, processed, category, priority, summary, contactId, dealId, followUpId)
       VALUES (@id, @fromAddr, @fromName, @toAddr, @subject, @body, @receivedAt, @processed, @category, @priority, @summary, @contactId, @dealId, @followUpId)`
    )
    .run({
      id: e.id,
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
      `INSERT INTO followUps (id, emailId, dealId, contactId, subject, draft, reason, status, createdAt, scheduledFor)
       VALUES (@id, @emailId, @dealId, @contactId, @subject, @draft, @reason, @status, @createdAt, @scheduledFor)`
    )
    .run({
      id: f.id,
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

// ---------- Contacts ----------

export function listContacts(): Contact[] {
  const rows = db()
    .prepare("SELECT * FROM contacts ORDER BY name COLLATE NOCASE ASC")
    .all() as ContactRow[];
  return rows.map(rowToContact);
}

export function getContact(contactId: string): Contact | undefined {
  const row = db()
    .prepare("SELECT * FROM contacts WHERE id = ?")
    .get(contactId) as ContactRow | undefined;
  return row ? rowToContact(row) : undefined;
}

export function findContactByEmail(email: string): Contact | undefined {
  const row = db()
    .prepare("SELECT * FROM contacts WHERE email = ? COLLATE NOCASE LIMIT 1")
    .get(email.trim()) as ContactRow | undefined;
  return row ? rowToContact(row) : undefined;
}

export function upsertContact(input: {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
}): Contact {
  const conn = db();
  const nowStr = now();
  // Race-safe upsert on email. When the row already exists, COALESCE the
  // incoming fields onto the existing ones so we don't wipe data on partial
  // updates.
  conn
    .prepare(
      `INSERT INTO contacts (id, name, email, company, phone, notes, createdAt, updatedAt)
       VALUES (@id, @name, @email, @company, @phone, @notes, @createdAt, @updatedAt)
       ON CONFLICT(email) DO UPDATE SET
         name      = CASE WHEN excluded.name  != '' THEN excluded.name  ELSE contacts.name  END,
         company   = COALESCE(excluded.company, contacts.company),
         phone     = COALESCE(excluded.phone,   contacts.phone),
         notes     = COALESCE(excluded.notes,   contacts.notes),
         updatedAt = excluded.updatedAt`
    )
    .run({
      id: newId(),
      name: input.name,
      email: input.email,
      company: input.company ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      createdAt: nowStr,
      updatedAt: nowStr,
    });

  // Re-read (the row we get back may be either the newly inserted one or the
  // existing-and-updated one; either way we want the canonical current state).
  const row = conn
    .prepare("SELECT * FROM contacts WHERE email = ? COLLATE NOCASE")
    .get(input.email) as ContactRow;
  return rowToContact(row);
}

// ---------- Deals ----------

export function listDeals(): Deal[] {
  const rows = db()
    .prepare("SELECT * FROM deals ORDER BY lastActivityAt DESC")
    .all() as DealRow[];
  return rows.map(rowToDeal);
}

export function getDeal(dealId: string): Deal | undefined {
  const row = db()
    .prepare("SELECT * FROM deals WHERE id = ?")
    .get(dealId) as DealRow | undefined;
  return row ? rowToDeal(row) : undefined;
}

export function findOpenDealForContact(contactId: string): Deal | undefined {
  const row = db()
    .prepare(
      `SELECT * FROM deals
       WHERE contactId = ? AND stage NOT IN ('won', 'lost')
       ORDER BY lastActivityAt DESC
       LIMIT 1`
    )
    .get(contactId) as DealRow | undefined;
  return row ? rowToDeal(row) : undefined;
}

export function createDeal(input: {
  title: string;
  contactId: string;
  stage?: DealStage;
  amount?: number;
  currency?: string;
  nextStep?: string;
}): Deal {
  const deal: Deal = {
    id: newId(),
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
  dealId: string,
  patch: Partial<Omit<Deal, "id" | "createdAt">>
): Deal | undefined {
  const conn = db();
  const existing = conn
    .prepare("SELECT * FROM deals WHERE id = ?")
    .get(dealId) as DealRow | undefined;
  if (!existing) return undefined;

  const nowStr = now();
  const lastActivityAt = patch.lastActivityAt ?? nowStr;
  const next: DealRow = {
    id: existing.id,
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
       WHERE id = @id`
    )
    .run({
      id: next.id,
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

export function listEmails(): Email[] {
  const rows = db()
    .prepare("SELECT * FROM emails ORDER BY receivedAt DESC")
    .all() as EmailRow[];
  return rows.map(rowToEmail);
}

export function getEmail(emailId: string): Email | undefined {
  const row = db()
    .prepare("SELECT * FROM emails WHERE id = ?")
    .get(emailId) as EmailRow | undefined;
  return row ? rowToEmail(row) : undefined;
}

export function createEmail(input: {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  receivedAt?: string;
}): Email {
  const email: Email = {
    id: newId(),
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
  emailId: string,
  patch: Partial<Omit<Email, "id">>
): Email | undefined {
  const conn = db();
  const existing = conn
    .prepare("SELECT * FROM emails WHERE id = ?")
    .get(emailId) as EmailRow | undefined;
  if (!existing) return undefined;

  const next: EmailRow = {
    id: existing.id,
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
       WHERE id = @id`
    )
    .run(next);

  return rowToEmail(next);
}

// ---------- Follow-ups ----------

export function listFollowUps(): FollowUp[] {
  const rows = db()
    .prepare("SELECT * FROM followUps ORDER BY createdAt DESC")
    .all() as FollowUpRow[];
  return rows.map(rowToFollowUp);
}

export function createFollowUp(input: {
  contactId: string;
  emailId?: string;
  dealId?: string;
  subject: string;
  draft: string;
  reason: string;
  scheduledFor?: string;
}): FollowUp {
  const followUp: FollowUp = {
    id: newId(),
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
  followUpId: string,
  patch: Partial<Omit<FollowUp, "id" | "createdAt">>
): FollowUp | undefined {
  const conn = db();
  const existing = conn
    .prepare("SELECT * FROM followUps WHERE id = ?")
    .get(followUpId) as FollowUpRow | undefined;
  if (!existing) return undefined;

  const next: FollowUpRow = {
    id: existing.id,
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
       WHERE id = @id`
    )
    .run({
      id: next.id,
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

// ---------- Maintenance ----------

export function resetStore(): StoreShape {
  const conn = db();
  const seed = seedStore();
  const tx = conn.transaction(() => {
    conn.exec(
      "DELETE FROM followUps; DELETE FROM emails; DELETE FROM deals; DELETE FROM contacts;"
    );
    for (const c of seed.contacts) insertContactRow(conn, c);
    for (const d of seed.deals) insertDealRow(conn, d);
    for (const e of seed.emails) insertEmailRow(conn, e);
    for (const f of seed.followUps) insertFollowUpRow(conn, f);
  });
  tx();
  return getSnapshot();
}

export function getSnapshot(): StoreShape {
  return {
    contacts: listContacts(),
    deals: listDeals(),
    emails: listEmails(),
    followUps: listFollowUps(),
  };
}
