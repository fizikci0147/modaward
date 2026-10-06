import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, now } from '../src/db/index.js';

for (const driver of ['node:sqlite', 'better-sqlite3']) {
  describe(`database (${driver})`, () => {
    test('opens, migrates and reports the driver', async () => {
      const db = await openDb(':memory:', { driver });
      assert.equal(db.driver, driver);
      const tables = db.all("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name);
      for (const t of ['users', 'sessions', 'garments', 'wear_log', 'catalog_products', 'schema_migrations']) assert.ok(tables.includes(t), t);
      db.close();
    });

    test('migrations are idempotent across reopen', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-db-'));
      const file = path.join(dir, 'a.db');
      const a = await openDb(file, { driver });
      const first = a.get('SELECT COUNT(*) AS n FROM schema_migrations').n;
      assert.ok(first >= 2);
      a.close();
      const b = await openDb(file, { driver });
      assert.equal(b.get('SELECT COUNT(*) AS n FROM schema_migrations').n, first);
      b.close();
      fs.rmSync(dir, { recursive: true });
    });

    test('foreign keys cascade and booleans/undefined bind safely', async () => {
      const db = await openDb(':memory:', { driver });
      db.run('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)', 'u1', 'a@b.co', 'x', now());
      db.run('INSERT INTO garments (id,user_id,name,category,type,color,warmth,formality,waterproof,favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        'g1', 'u1', 'Tee', 'top', 'tee', '#ffffff', 1, 1.5, true, undefined ?? false, now(), now());
      assert.equal(db.get('SELECT waterproof FROM garments').waterproof, 1);
      db.run('DELETE FROM users WHERE id = ?', 'u1');
      assert.equal(db.get('SELECT COUNT(*) AS n FROM garments').n, 0);
      db.close();
    });

    test('transactions roll back on error and nest', async () => {
      const db = await openDb(':memory:', { driver });
      assert.throws(() =>
        db.transaction(() => {
          db.run('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)', 'u1', 'a@b.co', 'x', now());
          db.transaction(() => db.run('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)', 'u2', 'c@d.co', 'x', now()));
          throw new Error('boom');
        })
      );
      assert.equal(db.get('SELECT COUNT(*) AS n FROM users').n, 0);
      db.close();
    });

    test('email uniqueness is case-insensitive', async () => {
      const db = await openDb(':memory:', { driver });
      db.run('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)', 'u1', 'Ann@Example.com', 'x', now());
      assert.throws(() => db.run('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)', 'u2', 'ann@example.com', 'x', now()));
      db.close();
    });
  });
}
