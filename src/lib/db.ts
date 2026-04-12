import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// Connection management lives here so it's the only file anyone has to
// rewrite when we move off SQLite. Everything else in the app treats
// `getConnection()` as an opaque handle passed into `src/lib/store.ts`.
//
// When DATABASE_URL is set, the Postgres backend is available. The actual
// swap happens in db-postgres.ts — this file stays SQLite-only so we can
// run both side by side during the transition. See docs/postgres-migration.md.

/**
 * True when DATABASE_URL is set and the app should use Postgres.
 * During the migration window we read from SQLite and dual-write to
 * Postgres; once validated, flip this to skip SQLite entirely.
 */
export function isPostgresEnabled(): boolean {
  return process.env.DB_BACKEND === "postgres" && Boolean(process.env.DATABASE_URL);
}

/**
 * Resolve the directory where the SQLite DB lives. Reads
 * SMB_AI_OPS_DATA_DIR at call time (not module load) so tests can
 * override it per-suite without relying on module reloading.
 */
export function dataDir(): string {
  return process.env.SMB_AI_OPS_DATA_DIR || path.join(process.cwd(), "data");
}

let _conn: Database.Database | null = null;

export interface ConnectionOptions {
  /**
   * Invoked exactly once per connection, right after the database is
   * opened and before `getConnection()` returns it. Callers use this to
   * run pragmas + schema migrations.
   */
  onOpen?: (conn: Database.Database) => void;
}

/**
 * Return the process-wide SQLite connection, opening it if needed.
 * The first call triggers `options.onOpen` — typically store.ts uses
 * that hook to set journal mode, foreign keys, and run schema migration.
 */
export function getConnection(options: ConnectionOptions = {}): Database.Database {
  if (_conn) return _conn;

  const dir = dataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const conn = new Database(path.join(dir, "store.sqlite"));
  if (options.onOpen) options.onOpen(conn);
  _conn = conn;
  return conn;
}

/**
 * Close and forget the cached connection. Tests call this between
 * suites so the next `getConnection()` reopens against whatever
 * SMB_AI_OPS_DATA_DIR now points at.
 */
export function closeConnection(): void {
  if (_conn) {
    _conn.close();
    _conn = null;
  }
}
