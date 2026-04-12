// Next.js instrumentation hook. Runs once at boot before any request is served.
// We use it to run database migrations so every deployment is self-migrating.
//
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Always run SQLite migrations (the default backend).
    // The lazy import ensures better-sqlite3 isn't bundled into the edge runtime.
    // Importing db triggers getConnection() which creates/opens the DB.
    // Importing store triggers migrate() at module scope.
    await import("./lib/db");
    await import("./lib/store");

    // When DATABASE_URL is configured, also run Postgres migrations so
    // the schema is ready for the dual-write phase.
    if (process.env.DATABASE_URL) {
      try {
        const { migratePostgres } = await import("./lib/db-postgres");
        await migratePostgres();
        console.log("[boot] Postgres schema migration complete");
      } catch (err) {
        console.warn("[boot] Postgres migration failed (non-fatal):", err);
      }
    }
  }
}
