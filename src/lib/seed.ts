import { randomUUID } from "node:crypto";
import type { StoreShape } from "./types";

// Sample data used to populate a freshly-created user's workspace.
// We seed a fictional local service business ("Willow Lane Salon") so
// new signups immediately see what the product looks like in use —
// real-looking clients, real-looking jobs, and a handful of unprocessed
// emails the AI pipeline can triage on their first click of "Process
// inbox". Every row carries the new user's id so the rows show up
// scoped under their account.

const DAY = 86_400_000;

export function seedStore(userId: string): StoreShape {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

  const clientSarahId = randomUUID();
  const clientMayaId = randomUUID();
  const clientEliseId = randomUUID();
  const clientJordanId = randomUUID();

  const jobSarahId = randomUUID();
  const jobMayaId = randomUUID();
  const jobEliseId = randomUUID();

  return {
    contacts: [
      {
        id: clientSarahId,
        userId,
        name: "Sarah Nguyen",
        email: "sarah.nguyen@gmail.com",
        company: "",
        phone: "+1 415 555 0118",
        notes:
          "Regular — balayage every 10-12 weeks. Prefers Saturday mornings.",
        createdAt: iso(90 * DAY),
        updatedAt: iso(2 * DAY),
      },
      {
        id: clientMayaId,
        userId,
        name: "Maya Patel",
        email: "maya.p@outlook.com",
        company: "",
        phone: "+1 415 555 0142",
        notes:
          "New client this spring. Color correction in progress — 3 sessions scoped.",
        createdAt: iso(40 * DAY),
        updatedAt: iso(1 * DAY),
      },
      {
        id: clientEliseId,
        userId,
        name: "Elise Rivera",
        email: "elise.rivera@fastmail.com",
        company: "",
        phone: "+1 415 555 0173",
        notes:
          "Wedding party — 4 people booked for the morning of the event.",
        createdAt: iso(20 * DAY),
        updatedAt: iso(4 * DAY),
      },
      {
        id: clientJordanId,
        userId,
        name: "Jordan Ashby",
        email: "jordan.ashby@protonmail.com",
        company: "",
        phone: "+1 415 555 0199",
        notes: "First inquiry — found us through Instagram.",
        createdAt: iso(1 * DAY),
        updatedAt: iso(1 * DAY),
      },
    ],
    deals: [
      {
        id: jobSarahId,
        userId,
        title: "Balayage touch-up + trim — Sarah",
        contactId: clientSarahId,
        stage: "scheduled",
        amount: 285,
        currency: "USD",
        nextStep: "Confirm the Saturday 10am slot",
        lastActivityAt: iso(2 * DAY),
        createdAt: iso(14 * DAY),
        updatedAt: iso(2 * DAY),
      },
      {
        id: jobMayaId,
        userId,
        title: "Color correction (session 2 of 3) — Maya",
        contactId: clientMayaId,
        stage: "in_progress",
        amount: 450,
        currency: "USD",
        nextStep: "Book session 3 — 3 weeks out from last visit",
        lastActivityAt: iso(1 * DAY),
        createdAt: iso(38 * DAY),
        updatedAt: iso(1 * DAY),
      },
      {
        id: jobEliseId,
        userId,
        title: "Bridal party updos (4 people) — Elise",
        contactId: clientEliseId,
        stage: "quoted",
        amount: 920,
        currency: "USD",
        nextStep: "Send quote + 50% deposit link",
        lastActivityAt: iso(4 * DAY),
        createdAt: iso(18 * DAY),
        updatedAt: iso(4 * DAY),
      },
    ],
    emails: [
      {
        id: randomUUID(),
        userId,
        from: "sarah.nguyen@gmail.com",
        fromName: "Sarah Nguyen",
        to: "willow@yourshop.com",
        subject: "Saturday 10am still good?",
        body: [
          "Hi!",
          "",
          "Just confirming my balayage appointment for Saturday at 10am.",
          "Also — do you have that toning shampoo you mentioned last time? Want to",
          "grab one if so.",
          "",
          "Thanks,",
          "Sarah",
        ].join("\n"),
        receivedAt: iso(3 * 60 * 60 * 1000),
        processed: false,
      },
      {
        id: randomUUID(),
        userId,
        from: "elise.rivera@fastmail.com",
        fromName: "Elise Rivera",
        to: "willow@yourshop.com",
        subject: "Re: wedding party quote",
        body: [
          "Hi,",
          "",
          "Thanks for getting back to me! The quote looks good. How do we handle",
          "the deposit — is there a link you can send over? Also, is there a",
          "chance we could do a trial run for me the week before?",
          "",
          "— Elise",
        ].join("\n"),
        receivedAt: iso(22 * 60 * 60 * 1000),
        processed: false,
      },
      {
        id: randomUUID(),
        userId,
        from: "payouts@square.com",
        fromName: "Square",
        to: "willow@yourshop.com",
        subject: "Payout of $1,842.50 sent",
        body: [
          "Hi Willow Lane Salon,",
          "",
          "A payout of $1,842.50 was just sent to your linked bank account,",
          "covering sales from April 3 through April 9.",
          "",
          "— Square",
        ].join("\n"),
        receivedAt: iso(2 * DAY),
        processed: false,
      },
      {
        id: randomUUID(),
        userId,
        from: "jordan.ashby@protonmail.com",
        fromName: "Jordan Ashby",
        to: "willow@yourshop.com",
        subject: "First-time appointment?",
        body: [
          "Hi there,",
          "",
          "I saw your work on Instagram and would love to book a first",
          "appointment. I'm looking to grow out a pixie cut into a bob and",
          "could use some help with the in-between stages. What's your",
          "availability look like over the next couple weeks?",
          "",
          "Thanks!",
          "Jordan",
        ].join("\n"),
        receivedAt: iso(5 * 60 * 60 * 1000),
        processed: false,
      },
    ],
    followUps: [],
  };
}
