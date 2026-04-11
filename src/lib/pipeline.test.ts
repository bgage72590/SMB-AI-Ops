import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  __resetDbForTests,
  createEmail,
  createUserRow,
  getContact,
  getDeal,
  findContactByEmail,
  findOpenDealForContact,
  listEmails,
  listFollowUps,
  listDealsForContact,
} from "./store";
import { processEmail } from "./pipeline";

// These tests run the pipeline end-to-end against a real SQLite store in a
// temp directory. ANTHROPIC_API_KEY is explicitly unset so the ai module
// takes its deterministic heuristic code path — no network, no mocks.

let tmpDir: string;
let userId: string;
const savedEnv: Record<string, string | undefined> = {};

const ENV_OVERRIDES = ["ANTHROPIC_API_KEY", "SMB_AI_OPS_DATA_DIR"] as const;

beforeEach(() => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  delete process.env.ANTHROPIC_API_KEY;

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-test-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  __resetDbForTests();

  const user = createUserRow({
    email: `user-${Date.now()}@example.test`,
    passwordHash: "scrypt$deadbeef$deadbeef",
    name: "Test Owner",
  });
  userId = user.id;
});

afterEach(() => {
  __resetDbForTests();
  for (const key of ENV_OVERRIDES) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

describe("processEmail (heuristic mode)", () => {
  it("creates a contact and marks the email processed for a new lead", async () => {
    const email = createEmail(userId, {
      from: "jordan@acme.co",
      fromName: "Jordan Riggs",
      to: "owner@yourshop.com",
      subject: "Interested in a demo",
      body: "Hi, we're evaluating vendors — can you share pricing?",
    });

    const result = await processEmail(userId, email);

    expect(result.category).toBe("new_lead");
    expect(result.contactId).toBeTruthy();

    const contact = findContactByEmail(userId, "jordan@acme.co");
    expect(contact?.name).toBe("Jordan Riggs");

    const [saved] = listEmails(userId);
    expect(saved.processed).toBe(true);
    expect(saved.contactId).toBe(contact?.id);
    expect(saved.summary).toBeTruthy();
  });

  it("drafts a follow-up when the heuristic flags one", async () => {
    const email = createEmail(userId, {
      from: "casey@example.com",
      fromName: "Casey Lin",
      to: "owner@yourshop.com",
      subject: "Pricing question",
      body: "Can you tell me how pricing works for a 20-seat team?",
    });

    const result = await processEmail(userId, email);

    // new_lead emails always trigger a follow-up in the heuristic path.
    expect(result.followUpId).toBeTruthy();
    const followUps = listFollowUps(userId);
    expect(followUps).toHaveLength(1);
    expect(followUps[0].status).toBe("draft");
    expect(followUps[0].contactId).toBe(result.contactId);
  });

  it("does not create a contact for a vague 'other' email", async () => {
    const email = createEmail(userId, {
      from: "newsletter@example.com",
      to: "owner@yourshop.com",
      subject: "Weekly roundup",
      body: "Here are some links.",
    });

    const result = await processEmail(userId, email);

    expect(result.category).toBe("other");
    // Heuristic only creates a contact for non-other/non-invoice categories
    // when there's no explicit suggested_contact; this sender should stay
    // out of the CRM so it doesn't pollute.
    expect(findContactByEmail(userId, "newsletter@example.com")).toBeUndefined();
    expect(result.contactId).toBeUndefined();
  });

  it("skips contact creation for invoice emails", async () => {
    const email = createEmail(userId, {
      from: "billing@stripe.com",
      to: "owner@yourshop.com",
      subject: "Your invoice is paid",
      body: "Receipt attached. ACH transfer cleared.",
    });

    const result = await processEmail(userId, email);

    expect(result.category).toBe("invoice");
    expect(result.contactId).toBeUndefined();
    expect(findContactByEmail(userId, "billing@stripe.com")).toBeUndefined();
  });

  it("reuses an existing contact instead of creating a duplicate", async () => {
    const firstEmail = createEmail(userId, {
      from: "pat@acme.co",
      fromName: "Pat Dev",
      to: "owner@yourshop.com",
      subject: "Demo request",
      body: "Would love a walkthrough of your tool.",
    });
    await processEmail(userId, firstEmail);
    const firstContact = findContactByEmail(userId, "pat@acme.co");
    expect(firstContact).toBeTruthy();

    const secondEmail = createEmail(userId, {
      from: "pat@acme.co",
      fromName: "Pat Dev",
      to: "owner@yourshop.com",
      subject: "Follow-up",
      body: "Just bumping this — any availability next week?",
    });
    await processEmail(userId, secondEmail);

    // Still exactly one contact for this email address.
    const contacts = listDealsForContact(userId, firstContact!.id);
    expect(findContactByEmail(userId, "pat@acme.co")?.id).toBe(firstContact!.id);
    // No orphan deals were created either.
    expect(contacts).toEqual([]);
  });

  it("scopes side effects to the userId passed in", async () => {
    // A second user in the same DB should see none of user 1's work.
    const otherUser = createUserRow({
      email: `other-${Date.now()}@example.test`,
      passwordHash: "scrypt$aaaa$bbbb",
      name: "Other Owner",
    });

    const email = createEmail(userId, {
      from: "alex@customer.io",
      fromName: "Alex",
      to: "owner@yourshop.com",
      subject: "Interested in pricing",
      body: "Can we chat next week?",
    });
    await processEmail(userId, email);

    expect(findContactByEmail(userId, "alex@customer.io")).toBeTruthy();
    expect(findContactByEmail(otherUser.id, "alex@customer.io")).toBeUndefined();
    expect(listEmails(otherUser.id)).toHaveLength(0);
    expect(listFollowUps(otherUser.id)).toHaveLength(0);
  });

  it("surfaces deal/contact references on the saved email row", async () => {
    const email = createEmail(userId, {
      from: "sam@bigco.com",
      fromName: "Sam Z",
      to: "owner@yourshop.com",
      subject: "Interested in a demo and pricing",
      body: "We're in evaluation mode. Can you share a demo and pricing?",
    });

    const result = await processEmail(userId, email);

    const [saved] = listEmails(userId);
    expect(saved.processed).toBe(true);
    expect(saved.contactId).toBe(result.contactId);
    expect(saved.category).toBe("new_lead");
    expect(saved.priority).toBe("high");

    // We can round-trip the contact through its id.
    const contact = getContact(userId, result.contactId!);
    expect(contact?.email).toBe("sam@bigco.com");

    // No deal suggested by the heuristic → no deal row. We verify by
    // checking findOpenDealForContact returns nothing for the contact.
    expect(findOpenDealForContact(userId, contact!.id)).toBeUndefined();
    if (result.dealId) {
      expect(getDeal(userId, result.dealId)).toBeUndefined();
    }
  });
});
