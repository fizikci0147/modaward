/**
 * Database access.
 *
 * Uses Node's built-in `node:sqlite` when present (Node ≥ 22.5) and falls back to the
 * optional `better-sqlite3` package, so the app runs on whichever Node version a host offers.
 * Both expose the same prepare/run/get/all surface; this wrapper hides the remaining differences.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function openDriver(file, prefer) {
  let sqlite = null;
  if (prefer !== 'better-sqlite3') {
    try {
      sqlite = await import('node:sqlite');
    } catch {
      sqlite = null;
    }
  }
  if (sqlite?.DatabaseSync) {
    return { driver: 'node:sqlite', raw: new sqlite.DatabaseSync(file) };
  }
  try {
    const mod = await import('better-sqlite3');
    return { driver: 'better-sqlite3', raw: new (mod.default || mod)(file) };
  } catch (cause) {
    throw new Error(
      'No SQLite driver available. Use Node.js 22.5 or newer (built-in node:sqlite), or run `npm install` so the optional better-sqlite3 package can be installed.',
      { cause }
    );
  }
}

/** node:sqlite rejects undefined and booleans; normalise bind parameters. */
const bind = (params) =>
  params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

export class Db {
  /** @param {{driver:string, raw:any}} handle */
  constructor(handle) {
    this.driver = handle.driver;
    this.raw = handle.raw;
    this.cache = new Map();
    this.depth = 0;
  }

  #stmt(sql) {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  exec(sql) {
    this.raw.exec(sql);
  }

  /** @returns {{changes:number, lastInsertRowid:number|bigint}} */
  run(sql, ...params) {
    const r = this.#stmt(sql).run(...bind(params));
    return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
  }

  /** First row or undefined. */
  get(sql, ...params) {
    const row = this.#stmt(sql).get(...bind(params));
    return row ? { ...row } : undefined;
  }

  all(sql, ...params) {
    return this.#stmt(sql)
      .all(...bind(params))
      .map((r) => ({ ...r }));
  }

  /**
   * Run `fn` atomically. Nested calls join the outer transaction.
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  transaction(fn) {
    if (this.depth > 0) return fn();
    this.exec('BEGIN IMMEDIATE');
    this.depth = 1;
    try {
      const result = fn();
      this.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.exec('ROLLBACK');
      } catch {
        /* connection already rolled back */
      }
      throw err;
    } finally {
      this.depth = 0;
    }
  }

  close() {
    this.cache.clear();
    this.raw.close();
  }
}

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const applied = new Set(db.all('SELECT version FROM schema_migrations').map((r) => r.version));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', version, Math.floor(Date.now() / 1000));
    });
  }
}

/**
 * Open (and migrate) the database.
 * @param {string} file  path, or ':memory:'
 * @param {{driver?: 'node:sqlite'|'better-sqlite3'}} [opts]  force a driver (used by tests)
 */
export async function openDb(file, { driver } = {}) {
  const db = new Db(await openDriver(file, driver));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (file !== ':memory:') {
    // WAL is faster, but needs shared-memory support that some hosting filesystems lack:
    // fall back to the classic journal instead of failing to start.
    try {
      const mode = db.get('PRAGMA journal_mode = WAL');
      if (String(mode?.journal_mode).toLowerCase() !== 'wal') db.exec('PRAGMA journal_mode = DELETE');
    } catch {
      try {
        db.exec('PRAGMA journal_mode = DELETE');
      } catch {
        /* keep the default */
      }
    }
    try {
      db.exec('PRAGMA synchronous = NORMAL');
    } catch {
      /* keep the default */
    }
  }
  migrate(db);
  return db;
}

export const now = () => Math.floor(Date.now() / 1000);
