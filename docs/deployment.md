# Deployment

SMB AI Ops runs as **one long-lived Node server on a VM with a persistent
disk**. That's a deliberate choice, not a stopgap:

- The database is a single SQLite file (`better-sqlite3`, WAL mode). It
  needs a real disk that survives restarts, which rules out serverless
  hosts like Vercel or Netlify functions.
- Background work (draining the job queue, the daily alert email, deal
  nudges, the Monday digest, backups) runs on an in-process scheduler
  (`src/lib/scheduler.ts`), so there's no external cron to wire up.

Because both the database and the scheduler live in the process, run
**exactly one instance**. Any VM works: a Hetzner/DigitalOcean/Linode box,
a Fly.io Machine with a volume, or a Mac mini on your desk.

## Requirements

- Node 24 LTS (22 is the minimum; `.nvmrc` pins 24)
- A persistent directory for the database, e.g. `/var/lib/smb-ai-ops`
- A reverse proxy for HTTPS (Caddy is the least work)

## Build

```bash
npm ci
npm run build
```

`next.config.js` sets `output: "standalone"`, so the build produces a
self-contained server in `.next/standalone`. Next doesn't copy static
assets into it; do that yourself:

```bash
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
```

`better-sqlite3` is a native module, so build on the same OS and CPU
architecture you deploy to (or build on the VM itself).

## Configure

Copy `.env.example` and fill in what you need. For production, set at
least:

| Variable | Why |
|---|---|
| `NODE_ENV=production` | Secure cookies, cron auth, and the scheduler default |
| `SMB_AI_OPS_DATA_DIR` | Where `store.sqlite` lives. Point it at the persistent disk |
| `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL` | Public URL for links, OAuth redirects, the widget |
| `ANTHROPIC_API_KEY` | Real triage and drafts (without it the app uses heuristics) |
| `CRON_SECRET` | Protects the manual `/api/jobs/*` triggers |
| `JOB_QUEUE_MODE=async` | "Process inbox" and the SendGrid webhook queue work for the scheduler instead of blocking the request |
| `PORT` | Defaults to 3000 |

### Per-workspace channels

Inbound traffic routes to a workspace only by something that workspace
owns. Nothing falls back to a default account.

- **Email:** each user gets an `inboundAddress` at signup. Point SendGrid
  Inbound Parse for `INBOUND_ADDRESS_DOMAIN` at
  `/api/webhooks/sendgrid/inbound?token=$SENDGRID_INBOUND_SECRET`.
- **SMS:** buy one Twilio number per workspace, set its incoming-message
  webhook to `/api/webhooks/twilio/incoming`, and assign it:
  `node scripts/assign-sms-number.mjs owner@example.com +15551234567`
  (run from the app directory with the same `SMB_AI_OPS_DATA_DIR`).
  `APP_BASE_URL` must be the exact public URL, because Twilio signs it.
- **Slack:** create one Slack app (scopes, redirect URL and event
  subscription are listed in `.env.example`). Each workspace connects its
  own channel under Settings → Slack.

## Run

```bash
cd .next/standalone
node server.js
```

Example systemd unit (`/etc/systemd/system/smb-ai-ops.service`):

```ini
[Unit]
Description=SMB AI Ops
After=network.target

[Service]
WorkingDirectory=/opt/smb-ai-ops/.next/standalone
ExecStart=/usr/bin/node server.js
EnvironmentFile=/opt/smb-ai-ops/.env
Restart=on-failure
User=smb-ai-ops

[Install]
WantedBy=multi-user.target
```

And a Caddyfile for HTTPS:

```
app.yourdomain.com {
  reverse_proxy localhost:3000
}
```

## Scheduler

The scheduler starts at boot from `src/instrumentation.ts` and ticks once
a minute. All times are UTC:

| Job | When |
|---|---|
| `job-queue` | Every minute |
| `backup` | Daily from 03:00, only when S3 backup is configured |
| `notifications` | Daily from 12:00 |
| `deal-decay` | Daily from 14:00 |
| `weekly-digest` | Mondays from 13:00 |

Daily and weekly jobs run on the first tick at or after their hour, so a
server that was down catches up when it comes back. Each firing is
recorded in the `scheduler_runs` table, so restarting can't run a job
twice in the same day.

The scheduler is on by default when `NODE_ENV=production` and off in
development. Set `SMB_AI_OPS_SCHEDULER=on` or `off` to override (for
example, to try it locally). The `/api/jobs/*` routes still work as manual
triggers with `Authorization: Bearer $CRON_SECRET`.
