#!/usr/bin/env node
/**
 * Diagnoses why ModaWard will not start on a host.   npm run doctor
 * Checks Node version, installed dependencies, SQLite support, the data folder and the database,
 * and prints what to fix.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
let problems = 0;
const show = (ok, label, detail = '', fix = '') => {
  if (ok === false) problems += 1;
  console.log(`${ok === null ? '–' : ok ? '✔' : '✖'} ${label}${detail ? `: ${detail}` : ''}`);
  if (ok === false && fix) console.log(`    → ${fix}`);
};

// Node
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = major > 20 || (major === 20 && minor >= 12);
show(nodeOk, 'Node.js version', process.version, 'Choose Node.js 22.x or 24.x in your host panel (20.12+ works, 18 does not).');

// files
for (const f of ['server.js', 'src/main.js', 'public/index.html', 'package.json']) show(fs.existsSync(path.join(root, f)), `file ${f}`, '', 'Upload the whole project folder; some files are missing.');

// dependencies
for (const dep of ['express', 'compression', 'nodemailer', '@anthropic-ai/sdk', 'web-push']) {
  let ok = true;
  try {
    require.resolve(dep);
  } catch {
    ok = false;
  }
  show(ok, `dependency ${dep}`, ok ? '' : 'not installed', 'Run "npm install --omit=dev" in the app folder (or press "Run NPM install" in your host panel), then restart.');
}

// SQLite
let driver = null;
try {
  await import('node:sqlite');
  driver = 'node:sqlite (built in)';
} catch {
  try {
    await import('better-sqlite3');
    driver = 'better-sqlite3';
  } catch {
    /* none */
  }
}
show(Boolean(driver), 'SQLite support', driver ?? 'none', 'Use Node.js 22.5 or newer (built-in SQLite), or make sure "npm install" completed so the optional better-sqlite3 package is present.');

// config + data folder + database
try {
  const { loadConfig } = await import('../src/config.js');
  const config = loadConfig();
  show(true, 'data folder', config.dataDir);
  if (driver) {
    const { openDb } = await import('../src/db/index.js');
    const db = await openDb(path.join(config.dataDir, 'modaward.db'));
    show(true, 'database', `${db.driver}, ${db.get('SELECT COUNT(*) AS n FROM users').n} users`);
    db.close();
  }
  show(Boolean(config.appUrl) || !config.production, 'APP_URL', config.appUrl || 'not set', 'Set APP_URL=https://yourdomain.com (needed in production for password-reset emails and payments).');
  show(null, 'port', process.env.PORT ? `PORT=${process.env.PORT}` : 'PORT not set (the app will use 8080; hosts normally provide PORT)');
} catch (e) {
  show(false, 'configuration / data folder', e.message, 'Set DATA_DIR to a folder you can write to, e.g. /home/<your-user>/modaward-data.');
}

console.log(problems ? `\n${problems} problem(s) found: fix the lines marked ✖, then restart the app.` : '\nEverything looks fine. If the site still shows 503, check that the startup file is set to server.js (or app.js) and that the app has been restarted.');
process.exit(problems ? 1 : 0);
