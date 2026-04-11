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
- **Postmark** for real email in (inbound webhook) and out (follow-up send)
- **SQLite** via `better-sqlite3` for persistence — WAL mode, race-safe
  upserts, one file at `data/store.sqlite`. Migrations run on boot.
- **Zod** for input validation

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

On first load the app creates `data/store.sqlite`, runs migrations, and
seeds it with a handful of sample contacts, deals, and emails. Hit
**Process inbox** on the dashboard to watch the AI triage and update the
CRM in real time.

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
│       │   └── send/        # POST: actually dispatch a draft via Postmark
│       ├── webhooks/
│       │   └── postmark/
│       │       └── inbound/ # Postmark inbound webhook target
│       └── reset/           # dev helper: restore the seed store
├── components/              # presentational React components
└── lib/
    ├── ai.ts                # Anthropic SDK wrapper (triage + drafting)
    ├── pipeline.ts          # email → CRM side-effects
    ├── postmark.ts          # Postmark send + inbound auth helpers
    ├── store.ts             # SQLite-backed persistence (better-sqlite3)
    ├── seed.ts              # sample data
    ├── types.ts             # domain types
    └── format.ts            # display helpers
```

## Wiring up a real inbox

You have two options:

### Option 1 — Postmark inbound (recommended)

1. In Postmark, create a server and enable an **inbound stream**.
2. Copy your server token + a verified sender into `.env`:
   ```
   POSTMARK_SERVER_TOKEN=your-server-token
   POSTMARK_FROM_EMAIL=you@yourdomain.com
   POSTMARK_INBOUND_SECRET=some-long-random-string
   ```
3. Set the inbound webhook URL in Postmark to:
   ```
   https://your-host.example.com/api/webhooks/postmark/inbound?token=YOUR_SECRET
   ```
   (Or use Basic Auth: `https://any:YOUR_SECRET@your-host.example.com/api/webhooks/postmark/inbound`)
4. Forward/reply to your Postmark inbound address. Emails hit the webhook,
   the pipeline runs synchronously, and the resulting contacts, deals, and
   follow-up drafts show up in the UI.

Once Postmark is configured, the **Send** button on the Follow-ups page
actually dispatches the drafted reply via the Postmark API and marks it sent.
If it's not configured, the same button degrades to **Mark sent** — a purely
local state change.

**Stronger auth (recommended for production).** Set
`POSTMARK_WEBHOOK_HMAC_SECRET` instead of (or in addition to) the shared
secret. When that env var is set, the inbound route requires an
`X-Signature: sha256=<hex>` header computed as HMAC-SHA256 of the raw body
under your secret, and the shared-secret checks are skipped. The secret
never travels over the wire, and a captured request can't be replayed
against a different body. Postmark doesn't sign inbound webhooks natively,
so this is meant to pair with a signing proxy (or any other provider whose
webhooks are HMAC-signed).

### Option 2 — raw POST

`POST /api/inbox` accepts a JSON body matching the `IngestSchema` in
`src/app/api/inbox/route.ts`. Useful for local testing or for pointing any
other provider (SendGrid parse, Cloudflare Email Routing, a tiny forwarding
worker) at the app.

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

- Calendar tool for the scheduling category (Cal.com or Google Calendar).
- Multi-user support + auth.
- Graduate persistence from SQLite to Postgres when multi-user lands.
- HMAC-based Postmark signature verification (currently shared-secret only).

## License

MIT
