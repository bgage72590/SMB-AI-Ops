# Postgres migration guide

This document is the plan for moving `src/lib/store.ts` off
`better-sqlite3` and onto Postgres. Nothing in this guide has been
executed yet — it exists so that when you decide to make the switch
you can do it in an afternoon without rediscovering the design.

## Why this is tractable

Every DB read and write in the app funnels through one file
(`src/lib/store.ts`). The rest of the codebase calls exported functions
like `listContacts(userId)` or `upsertContact(userId, input)` — never
raw SQL. That means the migration is almost entirely scoped to
`store.ts`: swap the driver, tweak ~a dozen SQL fragments, and change
the function signatures from sync to async.

The application already treats the store as async-friendly:

- Route handlers are `async` and `await` store calls in most places.
- Pipeline + jobs code uses `await` for every non-store async call.

The few places that assume synchronous returns (e.g. `seedWorkspace` in
`signup`, the heuristic digest computation) are listed below under
"Sync-to-async call sites to audit" and are small.

## What moves where

Today:

```
src/lib/store.ts      -- schema, connection, every query
```

After the split (and still SQLite — this is the first landing):

```
src/lib/db.ts         -- connection, migration, dialect-specific
                         helpers (prepared statements, pragmas)
src/lib/store.ts      -- every query, all exported functions
```

After the Postgres swap:

```
src/lib/db.ts         -- opens a pg pool, runs idempotent migrations
src/lib/store.ts      -- same exported shape, async, pg-flavored SQL
```

Nothing outside `src/lib/store.ts` + `src/lib/db.ts` needs to change.

## Schema changes

Every `CREATE TABLE IF NOT EXISTS` translates directly; the only dialect
differences we touch today are:

| SQLite                       | Postgres                              |
| ---------------------------- | ------------------------------------- |
| `TEXT PRIMARY KEY`           | `TEXT PRIMARY KEY` (unchanged)        |
| `INTEGER NOT NULL DEFAULT 0` | `INTEGER NOT NULL DEFAULT 0`          |
| `COLLATE NOCASE`             | `CITEXT` column type or `LOWER(...)` index |
| `ON CONFLICT(col) DO UPDATE SET ...` | `ON CONFLICT (col) DO UPDATE SET ...` (same syntax) |
| `datetime('now')`            | `now()` (we already pass ISO strings from JS, so this doesn't apply) |
| Partial unique index via `WHERE inboundAddress IS NOT NULL` | Same syntax in Postgres |

The only column-type change that matters is the `COLLATE NOCASE` usage
on `users.email` and `users.inboundAddress`. Two options:

1. **Use `citext`**. Add `CREATE EXTENSION IF NOT EXISTS citext;` and
   change `email TEXT` → `email CITEXT`. Queries drop the
   `COLLATE NOCASE` suffix.
2. **Functional index + lowercase on write**. Keep `TEXT`, lowercase in
   JS before writing, and create `CREATE UNIQUE INDEX ... ON users (LOWER(email))`.
   Slightly less ergonomic but avoids the extension.

Option 1 is cleaner and CITEXT is in every managed Postgres we've
shipped on. Recommend it.

## Driver swap

Install [`postgres`](https://github.com/porsager/postgres) (aka
`postgres.js`):

```
npm install postgres
npm uninstall better-sqlite3
```

Why `postgres.js` over `pg`: tagged-template SQL (which is great at
preventing injection for the ad-hoc queries we have), built-in pooling,
zero boilerplate for transactions, and it's tiny. If you'd rather go
with `pg`, the migration math is identical — just more verbose.

## The new `src/lib/db.ts`

```ts
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

export const sql = postgres(DATABASE_URL, {
  // One connection per serverless invocation; scale via pgbouncer.
  max: 10,
});

export async function migrate(): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS citext`;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      email          CITEXT NOT NULL UNIQUE,
      passwordHash   TEXT NOT NULL,
      name           TEXT NOT NULL,
      inboundAddress CITEXT,
      createdAt      TEXT NOT NULL,
      updatedAt      TEXT NOT NULL
    )
  `;
  // ...one statement per table. Safe to run on every boot because of
  // IF NOT EXISTS everywhere.
}
```

Call `migrate()` once at boot. In Vercel/Next deployments, the easiest
thing is to invoke it from a startup API route or from `instrumentation.ts`.

## Query translation checklist

Go through `store.ts` top-to-bottom. Every call to `db().prepare(...)`
becomes a tagged template. Examples:

### Simple SELECT

```ts
// Before
const row = db()
  .prepare("SELECT * FROM users WHERE id = ?")
  .get(userId) as UserRow | undefined;

// After
const [row] = await sql<UserRow[]>`
  SELECT * FROM users WHERE id = ${userId}
`;
```

### INSERT with returning

```ts
// Before
conn
  .prepare(
    `INSERT INTO sessions (id, userId, createdAt, expiresAt)
     VALUES (?, ?, ?, ?)`
  )
  .run(input.id, input.userId, createdAt, input.expiresAt);

// After (same SQL, just use tagged template)
await sql`
  INSERT INTO sessions (id, userId, createdAt, expiresAt)
  VALUES (${input.id}, ${input.userId}, ${createdAt}, ${input.expiresAt})
`;
```

### ON CONFLICT upsert

```ts
// Before
`INSERT INTO contacts (...)
 VALUES (@id, @userId, ...)
 ON CONFLICT(userId, email) DO UPDATE SET ...`

// After — named params become object interpolation
await sql`
  INSERT INTO contacts ${sql(input, "id", "userId", "name", "email", ...)}
  ON CONFLICT (userId, email) DO UPDATE SET
    name = EXCLUDED.name,
    ...
`;
```

### Counts / aggregates

`SELECT COUNT(*) AS c FROM users` returns `bigint` in Postgres — either
cast in the query (`COUNT(*)::int`) or `Number()` on the JS side. The
existing callers already do `row.c`, so cast in SQL for cleanliness.

### `RANDOM()`

We use `ORDER BY RANDOM()` nowhere. No change needed.

## Transactions

`better-sqlite3` has `conn.transaction(() => { ... })`. The equivalent
in `postgres.js`:

```ts
await sql.begin(async (tx) => {
  await tx`INSERT INTO ...`;
  await tx`UPDATE ...`;
});
```

Audit `store.ts` for any place that needs atomicity — today only the
`upsertContact` + `createDeal` couplings in `pipeline.ts` matter, and
those happen across multiple store calls. Moving those into a single
`sql.begin` block is a win independent of the migration.

## Sync-to-async call sites to audit

Everywhere the app calls `store.ts` is already in an async context,
with three known exceptions:

1. **`src/lib/auth.ts`** — `signup()`, `login()`, `requireUser()` are
   synchronous today. They call through to synchronous store helpers.
   Change all three to `async` and have every caller `await` them.
   Route handlers are already `async`, so this is mostly mechanical.
2. **`src/lib/digest.ts`** — `computeStats` is synchronous and walks
   the store. Either make it async, or pre-fetch all four lists with
   `Promise.all` at the top and keep the scoring logic pure.
3. **`src/lib/search.ts`** — same shape as `computeStats`. Same fix.

Server components in `src/app/**/page.tsx` can `await` directly, so
the page layer doesn't need structural changes — just `await` where
they currently bind to the store result.

## Testing strategy

1. Keep the existing vitest suite. It talks to the store through the
   public API and doesn't inspect SQLite-specific behavior.
2. Replace `SMB_AI_OPS_DATA_DIR` with `DATABASE_URL` per-test — point
   each suite at a fresh schema via
   `CREATE SCHEMA test_${uuid}`, `SET search_path TO test_${uuid}`.
3. The `__resetDbForTests()` hook becomes "drop and recreate the test
   schema". Same contract, different mechanics.
4. Run the suite against Dockerized Postgres in CI (`services: postgres`
   in the GitHub Actions workflow).

## Deployment

- **Managed Postgres**: Neon, Supabase, or Railway all work. Pick one
  with a generous free tier for dev and a $20-50/mo starter for prod.
- **Connection pooling**: Serverless + Postgres needs pgbouncer or the
  platform's built-in pool (Neon pooled connection string, Supabase
  pooler). Set `max: 1` on `postgres.js` when you're behind a pooler.
- **Migrations**: the `migrate()` function above is idempotent. Run it
  from `instrumentation.ts`:

  ```ts
  // src/instrumentation.ts
  export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const { migrate } = await import("./lib/db");
      await migrate();
    }
  }
  ```

  When you need real migrations (column additions, backfills), switch
  to `drizzle-kit` or `node-pg-migrate` — both drop cleanly onto the
  same `DATABASE_URL`.

## Order of operations

1. **Step 1: Split `db.ts` from `store.ts`** (can ship today, still
   SQLite). Move connection + `migrate` + `__resetDbForTests` out of
   `store.ts`. This PR is included in the current branch — see
   `src/lib/db.ts`. No behavior change.
2. **Step 2: Add an async wrapper around every store export**. Flip
   return types to `Promise<T>`. `better-sqlite3` is still underneath,
   so the promises resolve immediately. This is a mechanical codemod
   that makes every call site in the app use `await` without changing
   semantics.
3. **Step 3: Replace the `better-sqlite3` internals with `postgres.js`**
   inside `db.ts` + `store.ts`. All the call sites already `await`, so
   this is a pure-internal swap.
4. **Step 4: Delete SQLite-specific bits** from package.json and CI.

Each step is a shippable PR. The risky one is step 3; the other three
are pure refactors with test coverage held constant.

## What we're _not_ doing

- No ORM. Keeping raw SQL + TypeScript types is the right tradeoff for
  a codebase this small.
- No separate read replica logic. Single primary is fine until a real
  load problem shows up.
- No sharding. If we hit that scale, this document is the least of our
  worries.
