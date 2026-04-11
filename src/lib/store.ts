import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Contact,
  Deal,
  Email,
  FollowUp,
  StoreShape,
} from "./types";
import { seedStore } from "./seed";

// Simple JSON-file-backed store. Synchronous on purpose — keeps route handlers
// trivial and avoids the need for a real database in the MVP. If concurrency
// becomes an issue, swap this for SQLite/Postgres without changing call sites.

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

let cache: StoreShape | null = null;

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seedStore(), null, 2));
  }
}

function read(): StoreShape {
  if (cache) return cache;
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  cache = JSON.parse(raw) as StoreShape;
  return cache;
}

function write(next: StoreShape): void {
  cache = next;
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
}

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return randomUUID();
}

// ---------- Contacts ----------

export function listContacts(): Contact[] {
  return read().contacts.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function getContact(contactId: string): Contact | undefined {
  return read().contacts.find((c) => c.id === contactId);
}

export function findContactByEmail(email: string): Contact | undefined {
  const target = email.toLowerCase().trim();
  return read().contacts.find((c) => c.email.toLowerCase() === target);
}

export function upsertContact(input: {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
}): Contact {
  const state = read();
  const existing = findContactByEmail(input.email);
  if (existing) {
    const updated: Contact = {
      ...existing,
      name: input.name || existing.name,
      company: input.company ?? existing.company,
      phone: input.phone ?? existing.phone,
      notes: input.notes ?? existing.notes,
      updatedAt: now(),
    };
    write({
      ...state,
      contacts: state.contacts.map((c) => (c.id === existing.id ? updated : c)),
    });
    return updated;
  }
  const created: Contact = {
    id: id(),
    name: input.name,
    email: input.email,
    company: input.company,
    phone: input.phone,
    notes: input.notes,
    createdAt: now(),
    updatedAt: now(),
  };
  write({ ...state, contacts: [...state.contacts, created] });
  return created;
}

// ---------- Deals ----------

export function listDeals(): Deal[] {
  return read()
    .deals.slice()
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
}

export function getDeal(dealId: string): Deal | undefined {
  return read().deals.find((d) => d.id === dealId);
}

export function findOpenDealForContact(contactId: string): Deal | undefined {
  return read().deals.find(
    (d) => d.contactId === contactId && d.stage !== "won" && d.stage !== "lost"
  );
}

export function createDeal(input: {
  title: string;
  contactId: string;
  stage?: Deal["stage"];
  amount?: number;
  currency?: string;
  nextStep?: string;
}): Deal {
  const state = read();
  const deal: Deal = {
    id: id(),
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
  write({ ...state, deals: [...state.deals, deal] });
  return deal;
}

export function updateDeal(
  dealId: string,
  patch: Partial<Omit<Deal, "id" | "createdAt">>
): Deal | undefined {
  const state = read();
  const existing = state.deals.find((d) => d.id === dealId);
  if (!existing) return undefined;
  const updated: Deal = {
    ...existing,
    ...patch,
    updatedAt: now(),
    lastActivityAt: patch.lastActivityAt ?? now(),
  };
  write({
    ...state,
    deals: state.deals.map((d) => (d.id === dealId ? updated : d)),
  });
  return updated;
}

// ---------- Emails ----------

export function listEmails(): Email[] {
  return read()
    .emails.slice()
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
}

export function getEmail(emailId: string): Email | undefined {
  return read().emails.find((e) => e.id === emailId);
}

export function createEmail(input: {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  receivedAt?: string;
}): Email {
  const state = read();
  const email: Email = {
    id: id(),
    from: input.from,
    fromName: input.fromName,
    to: input.to,
    subject: input.subject,
    body: input.body,
    receivedAt: input.receivedAt ?? now(),
    processed: false,
  };
  write({ ...state, emails: [email, ...state.emails] });
  return email;
}

export function updateEmail(
  emailId: string,
  patch: Partial<Omit<Email, "id">>
): Email | undefined {
  const state = read();
  const existing = state.emails.find((e) => e.id === emailId);
  if (!existing) return undefined;
  const updated: Email = { ...existing, ...patch };
  write({
    ...state,
    emails: state.emails.map((e) => (e.id === emailId ? updated : e)),
  });
  return updated;
}

// ---------- Follow-ups ----------

export function listFollowUps(): FollowUp[] {
  return read()
    .followUps.slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  const state = read();
  const followUp: FollowUp = {
    id: id(),
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
  write({ ...state, followUps: [followUp, ...state.followUps] });
  return followUp;
}

export function updateFollowUp(
  followUpId: string,
  patch: Partial<Omit<FollowUp, "id" | "createdAt">>
): FollowUp | undefined {
  const state = read();
  const existing = state.followUps.find((f) => f.id === followUpId);
  if (!existing) return undefined;
  const updated: FollowUp = { ...existing, ...patch };
  write({
    ...state,
    followUps: state.followUps.map((f) => (f.id === followUpId ? updated : f)),
  });
  return updated;
}

// ---------- Maintenance ----------

export function resetStore(): StoreShape {
  const fresh = seedStore();
  write(fresh);
  return fresh;
}

export function getSnapshot(): StoreShape {
  return read();
}
