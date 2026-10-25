import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// Connection management lives here so it's the only file anyone has to
// rewrite when we move off SQLite. Everything else in the app treats
// `getConnection()` as an opaque handle passed into `src/lib/store.ts`.
//
// SQLite is the only backend. The app runs as one long-lived Node process
// with SMB_AI_OPS_DATA_DIR on a persistent disk. See docs/deployment.md.

/**
 * Resolve the directory where the SQLite DB lives. Reads
 * SMB_AI_OPS_DATA_DIR at call time (not module load) so tests can
 * override it per-suite without relying on module reloading.
 */
export function dataDir(): string {
  return process.env.SMB_AI_OPS_DATA_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data");
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
  const conn = new Database(path.join(/* turbopackIgnore: true */ dir, "store.sqlite"));
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
