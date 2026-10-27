import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Every API route that writes must go through apiRoute() (src/lib/guard.ts),
// so auth, plan and rate checks can't be forgotten on a new route. The only
// exceptions are routes with no signed-in user, listed here with the check
// they do instead.
const PUBLIC_WRITE_ROUTES: Record<string, string> = {
  "auth/login": "credentials + per-IP and per-account rate limits",
  "auth/logout": "only clears the caller's own session",
  "auth/signup": "per-IP rate limit; new accounts start unverified",
  "auth/password/request": "per-IP rate limit; never reveals if the email exists",
  "auth/password/reset": "one-time hashed token",
  "jobs/backup": "CRON_SECRET",
  "jobs/deal-decay": "CRON_SECRET",
  "jobs/notifications": "CRON_SECRET",
  "jobs/run": "CRON_SECRET",
  "jobs/weekly-digest": "CRON_SECRET",
  "webhooks/sendgrid/inbound": "shared secret; routes by envelope recipient",
  "webhooks/slack": "Slack signing secret; routes by team + channel",
  "webhooks/stripe": "Stripe signature",
  "webhooks/twilio/incoming": "Twilio signature; routes by number",
  "widget/chat": "signed widget token; owner plan + per-owner rate limit",
};

const API_DIR = path.join(__dirname, "..", "app", "api");

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

describe("guard coverage", () => {
  const routes = routeFiles(API_DIR).map((file) => ({
    name: path.relative(API_DIR, path.dirname(file)),
    source: fs.readFileSync(file, "utf8"),
  }));

  it("finds the API routes", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it("wraps every write handler in apiRoute()", () => {
    const unguarded: string[] = [];
    for (const { name, source } of routes) {
      if (name in PUBLIC_WRITE_ROUTES) continue;
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const declared = new RegExp(`export (async function|const) ${method}\\b`).test(source);
        const guarded = new RegExp(`export const ${method} = apiRoute\\(`).test(source);
        if (declared && !guarded) unguarded.push(`${method} /api/${name}`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it("keeps the public allowlist honest", () => {
    const names = new Set(routes.map((r) => r.name));
    for (const name of Object.keys(PUBLIC_WRITE_ROUTES)) {
      expect(names.has(name), `${name} no longer exists`).toBe(true);
      const { source } = routes.find((r) => r.name === name)!;
      expect(source, `${name} should not use apiRoute; remove it from the list`).not.toMatch(
        /apiRoute\(/
      );
    }
  });
});
