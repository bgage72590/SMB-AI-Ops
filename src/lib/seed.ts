import { randomUUID } from "node:crypto";
import type { StoreShape } from "./types";

// Sample data used to populate a freshly-created user's workspace. Every
// row carries the new user's id so it shows up scoped under their account.
// Emails are intentionally left `processed: false` so the AI pipeline has
// something to work on the first time they hit "Process inbox".

const DAY = 86_400_000;

export function seedStore(userId: string): StoreShape {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

  const contactAcmeId = randomUUID();
  const contactRiverId = randomUUID();
  const contactBoltId = randomUUID();

  const dealAcmeId = randomUUID();
  const dealRiverId = randomUUID();

  return {
    contacts: [
      {
        id: contactAcmeId,
        userId,
        name: "Marta Chen",
        email: "marta@acme-hvac.com",
        company: "Acme HVAC",
        phone: "+1 415 555 0102",
        notes: "Owns a 12-person HVAC shop. Wants to replace a spreadsheet workflow.",
        createdAt: iso(14 * DAY),
        updatedAt: iso(1 * DAY),
      },
      {
        id: contactRiverId,
        userId,
        name: "Devon Patel",
        email: "devon@riverside-legal.com",
        company: "Riverside Legal",
        phone: "+1 212 555 0144",
        notes: "Managing partner, 4 attorneys. Deal stalled last week.",
        createdAt: iso(30 * DAY),
        updatedAt: iso(8 * DAY),
      },
      {
        id: contactBoltId,
        userId,
        name: "Priya Osei",
        email: "priya@boltbakery.co",
        company: "Bolt Bakery",
        phone: "+1 503 555 0177",
        notes: "Wholesale bakery, 3 locations. Sent invoice last month.",
        createdAt: iso(60 * DAY),
        updatedAt: iso(20 * DAY),
      },
    ],
    deals: [
      {
        id: dealAcmeId,
        userId,
        title: "Acme HVAC — Ops rollout",
        contactId: contactAcmeId,
        stage: "proposal",
        amount: 12_000,
        currency: "USD",
        nextStep: "Send revised SOW",
        lastActivityAt: iso(1 * DAY),
        createdAt: iso(14 * DAY),
        updatedAt: iso(1 * DAY),
      },
      {
        id: dealRiverId,
        userId,
        title: "Riverside Legal — pilot",
        contactId: contactRiverId,
        stage: "negotiation",
        amount: 4_800,
        currency: "USD",
        nextStep: "Follow up on pricing",
        lastActivityAt: iso(9 * DAY),
        createdAt: iso(30 * DAY),
        updatedAt: iso(9 * DAY),
      },
    ],
    emails: [
      {
        id: randomUUID(),
        userId,
        from: "marta@acme-hvac.com",
        fromName: "Marta Chen",
        to: "you@yourshop.com",
        subject: "Re: revised proposal",
        body: [
          "Hey,",
          "",
          "Thanks for the walkthrough yesterday. The team is on board with the scope but",
          "we'd like to push the start date to the first week of next month. Can you send",
          "an updated SOW reflecting that? Also — do you integrate with ServiceTitan?",
          "",
          "— Marta",
        ].join("\n"),
        receivedAt: iso(3 * 60 * 60 * 1000),
        processed: false,
      },
      {
        id: randomUUID(),
        userId,
        from: "devon@riverside-legal.com",
        fromName: "Devon Patel",
        to: "you@yourshop.com",
        subject: "Quick question on pricing",
        body: [
          "Hi,",
          "",
          "We reviewed the quote internally. The per-seat cost is a little higher than",
          "we expected. Is there any flexibility if we commit to a 12-month term?",
          "",
          "Thanks,",
          "Devon",
        ].join("\n"),
        receivedAt: iso(26 * 60 * 60 * 1000),
        processed: false,
      },
      {
        id: randomUUID(),
        userId,
        from: "ap@boltbakery.co",
        fromName: "Bolt Bakery AP",
        to: "you@yourshop.com",
        subject: "Invoice #2041 — paid",
        body: [
          "Hi,",
          "",
          "Just a note that invoice #2041 for $1,250 has been paid via ACH today.",
          "Confirmation number BB-99221.",
          "",
          "— Priya / Bolt Bakery",
        ].join("\n"),
        receivedAt: iso(2 * DAY),
        processed: false,
      },
      {
        id: randomUUID(),
        userId,
        from: "hello@newleadco.io",
        fromName: "Jordan Riggs",
        to: "you@yourshop.com",
        subject: "Interested in a demo",
        body: [
          "Hi there,",
          "",
          "I run operations at a 22-person roofing company in Austin. A friend recommended",
          "you for automating our email + invoicing workflow. Could we grab 20 minutes",
          "next week to see a demo?",
          "",
          "— Jordan",
        ].join("\n"),
        receivedAt: iso(5 * 60 * 60 * 1000),
        processed: false,
      },
    ],
    followUps: [],
  };
}
