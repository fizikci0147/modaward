#!/usr/bin/env node
/**
 * Consistent backup of the database (and a manifest of uploaded photos).
 *   npm run backup                 → <DATA_DIR>/backups/modaward-YYYY-MM-DD.db
 *   node scripts/backup.mjs <dir>  → into a directory of your choice
 * Uses SQLite's VACUUM INTO, which is safe while the app is running. Keeps the 14 newest backups.
 * Photos live in <DATA_DIR>/uploads: back that folder up alongside (Hostinger's backups or rsync).
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db/index.js';

const config = loadConfig();
const dir = path.resolve(process.argv[2] || path.join(config.dataDir, 'backups'));
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().slice(0, 10);
const target = path.join(dir, `modaward-${stamp}.db`);
if (fs.existsSync(target)) fs.unlinkSync(target);

const db = await openDb(path.join(config.dataDir, 'modaward.db'));
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
const users = db.get('SELECT COUNT(*) AS n FROM users').n;
db.close();

const photos = fs.existsSync(path.join(config.dataDir, 'uploads')) ? fs.readdirSync(path.join(config.dataDir, 'uploads')).length : 0;
console.log(`Backed up ${users} users to ${target} (${(fs.statSync(target).size / 1024).toFixed(0)} KB). ${photos} photos live in ${path.join(config.dataDir, 'uploads')}.`);

const old = fs.readdirSync(dir).filter((f) => /^modaward-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse().slice(14);
for (const f of old) fs.unlinkSync(path.join(dir, f));
if (old.length) console.log(`Removed ${old.length} old backup(s).`);
