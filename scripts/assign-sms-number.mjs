#!/usr/bin/env node
// Assign a Twilio number to a workspace, or release it.
//
//   node scripts/assign-sms-number.mjs owner@example.com +15551234567
//   node scripts/assign-sms-number.mjs owner@example.com --release
//
// Buy the number in the Twilio console first and set its "A message comes
// in" webhook to https://<your host>/api/webhooks/twilio/incoming.
// Reads the same database the app uses (SMB_AI_OPS_DATA_DIR or ./data).
// Start the app once before running this so migrations have run.

import path from "node:path";
import Database from "better-sqlite3";

const [email, number] = process.argv.slice(2);
if (!email || !number) {
  console.error("usage: assign-sms-number.mjs <user email> <+E164 number | --release>");
  process.exit(2);
}

const release = number === "--release";
const normalized = release ? null : number.replace(/[^+\d]/g, "");
if (!release && !/^\+\d{8,15}$/.test(normalized)) {
  console.error(`Not an E.164 number: ${number} (expected e.g. +15551234567)`);
  process.exit(2);
}

const dir = process.env.SMB_AI_OPS_DATA_DIR || path.join(process.cwd(), "data");
const db = new Database(path.join(dir, "store.sqlite"), { fileMustExist: true });

const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes("smsNumber")) {
  console.error("The database hasn't been migrated yet. Start the app once, then retry.");
  process.exit(1);
}

const user = db.prepare("SELECT id, smsNumber FROM users WHERE email = ? COLLATE NOCASE").get(email);
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

if (normalized) {
  const holder = db.prepare("SELECT email FROM users WHERE smsNumber = ? AND id != ?").get(normalized, user.id);
  if (holder) {
    console.error(`${normalized} already belongs to ${holder.email}. Release it there first.`);
    process.exit(1);
  }
}

db.prepare("UPDATE users SET smsNumber = ?, updatedAt = ? WHERE id = ?").run(
  normalized,
  new Date().toISOString(),
  user.id
);
console.log(
  release
    ? `Released ${user.smsNumber ?? "(none)"} from ${email}`
    : `Assigned ${normalized} to ${email}`
);
