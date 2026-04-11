# SMB AI Ops

**An AI office manager for small businesses.**

SMBs are drowning in email, invoices, CRM updates, and scheduling. The existing
options are either too complex (Salesforce, HubSpot) or too generic (ChatGPT).
This repo is an opinionated take on the middle ground: a small, focused product
that reads your inbox, keeps your CRM up to date, drafts follow-ups in your
voice, and surfaces what actually needs attention.

## What it does today

- **Inbox triage.** Every incoming email is classified (new lead, deal update,
  invoice, needs reply, scheduling, other), prioritized, and summarized in one
  sentence.
- **Auto-CRM.** Contacts and deals are created or updated from email content.
  Deal stages move forward automatically based on what the sender says.
- **Follow-up drafts.** When a reply is needed, the model drafts a short,
  founder-voice follow-up that you can send, edit, or dismiss with one click.
- **Dashboard.** Pipeline value, unread count, pending follow-ups, and a view
  of recent activity, all on one screen.

The AI work runs through the Anthropic Messages API (Claude Opus 4.6 by
default) using tool-use calls so responses are structured and safe to parse.
Prompt caching is enabled on the static system prompts so repeated inbox
processing runs cheaply.

## Stack

- **Next.js 14** (App Router, Server Components) + **TypeScript**
- **Tailwind CSS** for styling
- **@anthropic-ai/sdk** for the AI layer
- **Zod** for input validation
- A **JSON-file store** at `data/store.json` for persistence (swap for SQLite
  or Postgres when you outgrow it — the `src/lib/store.ts` API stays the same)

## Getting started

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY

# 3. Run
npm run dev
# open http://localhost:3000
```

On first load the app seeds `data/store.json` with a handful of sample
contacts, deals, and emails. Hit **Process inbox** on the dashboard to watch
the AI triage and update the CRM in real time.

Without an API key the app still runs — it falls back to a simple heuristic
triage so you can click around the UI. Set the key to get real summaries and
drafts.

## Project layout

```
src/
├── app/
│   ├── page.tsx             # dashboard
│   ├── inbox/page.tsx       # incoming email + triage
│   ├── deals/page.tsx       # pipeline board
│   ├── contacts/page.tsx    # CRM table
│   ├── followups/page.tsx   # drafted replies
│   └── api/
│       ├── inbox/           # POST an email, optionally auto-process
│       ├── process/         # run the AI pipeline on one or all emails
│       ├── contacts/
│       ├── deals/
│       ├── followups/
│       └── reset/           # dev helper: restore the seed store
├── components/              # presentational React components
└── lib/
    ├── ai.ts                # Anthropic SDK wrapper (triage + drafting)
    ├── pipeline.ts          # email → CRM side-effects
    ├── store.ts             # JSON-file-backed persistence
    ├── seed.ts              # sample data
    ├── types.ts             # domain types
    └── format.ts            # display helpers
```

## Wiring up a real inbox

`POST /api/inbox` accepts a JSON body matching the `IngestSchema` in
`src/app/api/inbox/route.ts`. Point whatever email-forwarding service you like
(Postmark inbound, SendGrid parse, Cloudflare Email Routing + a tiny worker,
etc.) at that endpoint and the pipeline will take over from there.

```bash
curl -X POST http://localhost:3000/api/inbox \
  -H 'content-type: application/json' \
  -d '{
    "from": "jordan@example.com",
    "fromName": "Jordan Riggs",
    "to": "you@yourshop.com",
    "subject": "Interested in a demo",
    "body": "Hi, can we chat next week?"
  }'
```

## Roadmap

The MVP is deliberately narrow. Obvious next steps:

- Real email provider integration (Postmark inbound is the cleanest MVP).
- Calendar tool for the scheduling category (Cal.com or Google Calendar).
- Actual sending of approved follow-ups (same provider).
- Multi-user support + auth.
- Swap the JSON store for SQLite (better-sqlite3) or Postgres.

## License

MIT
