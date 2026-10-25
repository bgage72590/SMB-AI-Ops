// Next.js instrumentation hook. Runs once at boot before any request is served.
// We use it to run database migrations so every deployment is self-migrating,
// and to start the in-process job scheduler.
//
// See: https://nextjs.org/docs/app/guides/instrumentation

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // The lazy import ensures better-sqlite3 isn't bundled into the edge runtime.
    // Importing db triggers getConnection() which creates/opens the DB.
    // Importing store triggers migrate() at module scope.
    await import("./lib/db");
    await import("./lib/store");

    const { isSchedulerEnabled, startScheduler } = await import("./lib/scheduler");
    if (isSchedulerEnabled()) startScheduler();
  }
}
