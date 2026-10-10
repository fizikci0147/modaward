#!/usr/bin/env node
/**
 * Consistent backup of the database and the secrets the app generated.
 *   npm run backup                 → <DATA_DIR>/backups/modaward-YYYY-MM-DD.db (+ secrets-YYYY-MM-DD/)
 *   node scripts/backup.mjs <dir>  → into a directory of your choice
 * Uses SQLite's VACUUM INTO, which is safe while the app is running. Keeps the 14 newest backups.
 *
 * Photos live in <DATA_DIR>/uploads and are not copied here: back that folder up alongside
 * (Hostinger's backups or rsync). Copy the backup directory OFF this server as well: a backup on
 * the same disk does not survive losing the disk.
 *
 * It refuses to run when it cannot find a real database (for example when DATA_DIR is not set
 * for a scheduled job), because a "successful" backup of an empty database would, after two weeks,
 * push every good backup out of the rotation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db/index.js';

const die = (msg) => {
  console.error(`Backup NOT made: ${msg}`);
  process.exit(1);
};

const config = loadConfig();
const dbFile = path.join(config.dataDir, 'modaward.db');
if (!fs.existsSync(dbFile)) die(`there is no database at ${dbFile}. Is DATA_DIR set for this job? (Scheduled jobs do not inherit the app's environment variables.)`);

const dir = path.resolve(process.argv[2] || path.join(config.dataDir, 'backups'));
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().slice(0, 10);
const target = path.join(dir, `modaward-${stamp}.db`);
const partial = `${target}.partial`;
fs.rmSync(partial, { force: true });

const db = await openDb(dbFile);
try {
  db.exec(`VACUUM INTO '${partial.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

// check the copy itself, not the original
const copy = await openDb(partial);
const check = copy.get('PRAGMA integrity_check');
const users = copy.get('SELECT COUNT(*) AS n FROM users').n;
copy.close();
if (String(check?.integrity_check) !== 'ok') {
  fs.rmSync(partial, { force: true });
  die('the copy failed SQLite’s integrity check; the previous backup was left untouched.');
}
if (users === 0 && !process.argv.includes('--allow-empty')) {
  fs.rmSync(partial, { force: true });
  die('the database has no users, which looks like the wrong database. Use --allow-empty if that is really intended.');
}
fs.chmodSync(partial, 0o600);
fs.renameSync(partial, target); // only now does today's backup replace yesterday's attempt

// the keys the app generated: without them old unsubscribe links, shop links and push subscriptions stop working
const secrets = path.join(config.dataDir, 'secrets');
let secretCount = 0;
if (fs.existsSync(secrets)) {
  const out = path.join(dir, `secrets-${stamp}`);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  for (const f of fs.readdirSync(secrets)) {
    if (!fs.statSync(path.join(secrets, f)).isFile()) continue;
    fs.copyFileSync(path.join(secrets, f), path.join(out, f));
    fs.chmodSync(path.join(out, f), 0o600);
    secretCount += 1;
  }
}

const uploads = path.join(config.dataDir, 'uploads');
const photos = fs.existsSync(uploads) ? fs.readdirSync(uploads).length : 0;
console.log(`Backed up ${users} users to ${target} (${(fs.statSync(target).size / 1024).toFixed(0)} KB) with ${secretCount} secret file(s). ${photos} photos live in ${uploads}.`);
console.log('Remember to copy this backup folder somewhere off this server.');

const names = fs.readdirSync(dir);
const old = names.filter((f) => /^modaward-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse().slice(14);
for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
for (const f of names.filter((n) => /^secrets-\d{4}-\d{2}-\d{2}$/.test(n)).sort().reverse().slice(14)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
if (old.length) console.log(`Removed ${old.length} old backup(s).`);
