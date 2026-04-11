# SMB AI Ops — short-term roadmap to sellable

This roadmap covers the path from "working prototype" to "a product a
small business owner would pay $49/mo for and not churn out of in
week 2." It is intentionally opinionated and ordered: each phase
unlocks the next, and no phase is skippable without leaving money on
the table.

## Where we are today

Shipped and in main:

- Multi-user auth (email + password, scrypt, opaque session cookies)
- Multi-tenant SQLite store scoped by `userId` on every read
- Postmark inbound webhook with HMAC signature verification
- Postmark outbound for follow-up sending
- Anthropic-powered triage + follow-up drafting with heuristic fallback
- Scheduling link injection in follow-ups
- Contact + deal detail pages with activity timelines
- Cmd-K global search palette
- Password reset via one-shot hashed tokens with session revoke
- Background job queue (SQLite-backed) with exponential backoff
- Weekly AI digest endpoint, cron-secret-guarded
- Postgres migration plan documented, connection layer split out
- CI: typecheck + vitest + build on every PR
- 44 vitest cases covering auth, pipeline, postmark, search, digest, jobs

In other words: the core loop (inbox in → CRM updated → follow-up
drafted → owner reviews) works end-to-end, for multiple users, with
tests. That's the floor. The rest of this document is how we turn it
into a product.

## Phase 1 — Own the golden path (week 1-2)

The goal of Phase 1 is to make the "I wire up my inbox, a lead comes
in, I approve the draft, it sends" flow feel magical on first touch.
Everything here is high-leverage because it touches every user in
their first 10 minutes.

### 1.1 Real Postmark inbound hookup for new signups

Today `inboundAddress` is a column on `users` but the signup flow
doesn't populate it. A new user has to ask an admin to set it.

- Auto-mint an inbound address on signup: `user-<shortid>@inbound.smb-ai-ops.com`.
- Update the settings page to show the address with a copy button.
- Verify the flow end-to-end: signup → copy inbound → send test email
  from your own inbox → see it land in /inbox within 10s.

**Acceptance:** a brand-new user can forward real mail to their
workspace without anyone touching the DB.

### 1.2 Gmail / Google Workspace "one-click forward" setup

Postmark inbound is great but nobody wants to configure forwarding
rules by hand. Ship a 3-screen onboarding walkthrough that:

1. Tells them to add a Gmail filter → auto-forward matching threads.
2. Shows them the exact filter syntax to copy/paste (`is:inbox -label:handled`).
3. Waits for the first email to land and shows a success state on the
   dashboard.

**Acceptance:** from signup to "AI just drafted a reply to my first
real email" in under 4 minutes.

### 1.3 Deal-worthy draft approval UX

Right now drafts live in `/followups` and approval is a single
button. We need:

- Keyboard shortcuts: `a` approve, `e` edit inline, `d` dismiss.
- Inline edit without leaving the list (textarea swap).
- A footer "Send now / Schedule for later" toggle.
- Actual sending (via the existing Postmark outbound function) when
  approved. Today approval flips status but never emails. This is the
  single biggest gap between prototype and product.

**Acceptance:** approving a draft actually sends the email via
Postmark, updates the deal's `lastActivityAt`, and logs the sent mail
in the email history for that contact.

### 1.4 Billing

Stripe Checkout + customer portal. Single $49/mo plan for starters.
Signup is free but after a 14-day trial the product goes read-only
until the user adds a card. Use `user.trialEndsAt` + a middleware
guard on write routes.

- Webhook: `checkout.session.completed` → flip the user to active.
- Webhook: `customer.subscription.deleted` → flip back to trial-ended.
- Billing portal link in settings.

**Acceptance:** I can sign up, hit the trial wall on day 15, pay $49,
keep using the product, cancel from the portal, and lose write access
on my next pageview.

## Phase 2 — Retention + trust (week 3-4)

Phase 2 is about keeping the users Phase 1 converts. If they churn in
week 2, none of the rest matters.

### 2.1 Observable AI spend

Every Anthropic call should log: user, model, input tokens, output
tokens, tool name, latency, cost estimate. Put it in a new
`ai_events` table. Expose a `/settings/usage` page so owners can see
what their AI is costing them. Important for both billing and trust —
"black box that sends Postmark via my domain" is a scary product.

### 2.2 Scoped permissions per email

Today the inbound webhook processes every email that lands in the
user's forwarded inbox. That's terrifying — a personal thread from
their spouse will get summarized, and an LLM will get the body.
Ship:

- A blocklist of sender domains (their own domain, family domains,
  banking, etc.) configured on the settings page.
- A "train" button on each triaged email: "don't learn from this" →
  re-classifies as `other` and quarantines from future model context.
- An explicit "this email will be sent to Anthropic" disclosure on
  the inbound onboarding screen, with a per-thread opt-out.

### 2.3 Deal decay and "leads going cold" nudges

The AI already classifies deal_update emails, but nobody tells the
owner when a deal has been quiet for 5 days. Add:

- A cron job that scans for `stage in (qualified, proposal, negotiation)`
  with `lastActivityAt > 5 days` and queues a follow-up draft.
- Surface these in the digest email from Phase 0.

### 2.4 Audit log

A simple append-only `audit_log` table: userId, action, entityType,
entityId, at. Every write action logs a row. Rendered as a timeline
on settings/audit. This is what lets the owner trust the AI when it
mutates their CRM.

## Phase 3 — Multi-channel and team (month 2)

### 3.1 SMS follow-ups via Twilio

Huge for the SMB segment — most of them live in SMS, not email. One
new provider module, a few new columns on `followUps` (channel: email
| sms), and a Twilio outbound helper. Start by allowing SMS only for
existing contacts with a phone on file.

### 3.2 Calendar integration

Today we inject a scheduling link. Next step: actually read the user's
calendar so the AI can propose specific times. Start with Google
Calendar OAuth (single provider, covers 90% of SMB). Use the calendar
availability to feed the draft prompt.

### 3.3 Team members

Second owner per workspace. One workspace, two users, shared contacts
+ deals + inbox, separate email credentials for outbound. Needed as
soon as one user hits "I want my assistant to also see this."
Introduce a `workspaces` table, pivot `users` to `workspace_members`,
and move every `userId` scope to `workspaceId`. The store already has
a single scoping seam so this is one weekend of work.

## Phase 4 — Postgres, reliability, compliance (month 3)

### 4.1 Execute the Postgres migration

Follow `docs/postgres-migration.md`. Steps 1-2 (db.ts split, async-
ification) are mechanical. Step 3 (driver swap) is the risky one —
gate behind a feature flag, dual-write for one week, switch reads.

### 4.2 Backups

Until we're on managed Postgres, there are no backups. Either:

- Nightly SQLite dump to S3 with `sqlite3 .dump | gzip | aws s3 cp`.
- Or (better) do Phase 4.1 first and let Neon/Supabase handle it.

### 4.3 Deliverability

Owner-domain signing for outbound Postmark. If we're sending from
`owner@theirshop.com`, we need SPF + DKIM on their domain. Ship a
wizard that walks them through adding the DNS records and verifies
them before letting them send.

### 4.4 SOC2-lite compliance checklist

- Encrypt the SQLite file at rest (file-system encryption).
- Force HTTPS everywhere (Vercel does this already).
- Rate-limit auth endpoints with a simple in-memory counter keyed by
  IP, then move to a Redis counter when we have Redis.
- Log security-relevant events to audit_log.
- Document a data deletion process — for GDPR asks later.

## Phase 5 — The "real product" features (month 4+)

These are the things that let us charge $149/mo instead of $49:

- **Pipeline reports and forecasts.** Weighted pipeline by stage,
  win rate over time, deals-at-risk. One dashboard page, one cron
  that materializes the numbers nightly.
- **Lead enrichment.** Clearbit / Apollo / People Data Labs lookup
  when a new contact lands. Cache by email so we don't double-pay.
- **Slack integration.** One more inbound channel and one more
  notification channel. Write the adapter once, reuse everywhere.
- **Website chat widget.** An embeddable JS snippet on the SMB's
  site that drops conversations straight into the inbox as new
  leads. This is the first "net-new lead source" we can claim, which
  is the #1 reason SMBs pay for tools like this.
- **Open-ended ask box.** "What should I focus on this week?" "Draft
  a hard-close email to Jordan." Same LLM, same DB, dedicated UI.
- **Custom fields on contacts and deals.** A single `metadata JSONB`
  column + a UI for editing schema. Needed the first time a customer
  says "our deals have a region."

## Non-goals (intentionally not on this roadmap)

- Native mobile apps. The web app needs to be mobile-usable — that's
  a much cheaper solve.
- A full marketing-automation suite. We're an AI office manager,
  not HubSpot. Saying no to this is a feature.
- Marketplace of prompts / templates. Not until we have 1k paying
  customers.
- On-prem / self-hosted distribution. Not in the first year.

## Concrete definition of "sellable"

Sellable means we can point at the product and an SMB owner with
zero handholding will:

1. Sign up and wire up their inbox in under 5 minutes.
2. See the AI act on a real email within the first session.
3. Approve and send at least one follow-up per day for a week.
4. Hit the paywall and pay.
5. Still be using it 30 days later.

Phases 1 + 2 cover exactly that. Phase 3 is "build moat while earning."
Phases 4-5 are how we get from "a product" to "a business."

## Immediate next tasks (the week after this PR lands)

1. Mint inbound address on signup and show it on `/settings`.
2. Make approving a follow-up actually send the email.
3. Add `ai_events` table + per-call logging.
4. Ship Stripe Checkout for the trial → paid path.

Everything in that list is 1-3 days of focused work. Shipping those
four items in order puts us at a demoable product we can start
charging for by the end of the month.
