#!/usr/bin/env node
/**
 * Build the deployable zip for Hostinger (or any Node host): dist/modaward-<version>.zip
 * It contains the app, the built-in frontend and the lockfile: no tests, no dev tooling, no secrets,
 * no node_modules (the host runs `npm install --omit=dev`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// refuse to package a broken tree
for (const script of ['check.mjs']) {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
}

const include = ['server.js', 'app.js', 'index.js', 'package.json', 'package-lock.json', '.env.example', 'README.md', 'src', 'public', 'docs', 'scripts/backup.mjs', 'scripts/import-feed.mjs', 'scripts/doctor.mjs', 'scripts/live-check.mjs', 'scripts/package.json'];
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `modaward-${pkg.version}.zip`);
if (fs.existsSync(file)) fs.unlinkSync(file);

const zip = spawnSync('zip', ['-rq', file, ...include, '-x', '*.DS_Store', '-x', '*/node_modules/*'], { cwd: root, stdio: 'inherit' });
if (zip.error || zip.status !== 0) {
  console.error('The `zip` command is required to build the archive (install it, or upload the folder via Git instead).');
  process.exit(1);
}
const size = fs.statSync(file).size;
console.log(`\nBuilt ${path.relative(root, file)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
