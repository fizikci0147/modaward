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

// Every zip must be exactly one commit: refuse to package uncommitted work, and refuse a version
// that has no changelog entry, so versions cannot be forgotten.
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout?.trim() ?? '';
const sha = git('rev-parse', '--short', 'HEAD') || 'unknown';
const dirty = git('status', '--porcelain', '--', '.', ':!BUILD.json', ':!dist') !== '';
const allowDirty = process.argv.includes('--allow-dirty');
if (dirty && !allowDirty) {
  console.error('There are uncommitted changes. Commit them first so the zip matches a commit (or pass --allow-dirty for a throwaway build).');
  process.exit(1);
}
const changelog = fs.existsSync(path.join(root, 'CHANGELOG.md')) ? fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8') : '';
if (!changelog.includes(`## [${pkg.version}]`)) {
  console.error(`CHANGELOG.md has no entry for ${pkg.version}. Add one (and bump the version with "npm version <patch|minor|major> --no-git-tag-version" if this is a new release).`);
  process.exit(1);
}
const buildId = `${pkg.version}+${sha}${dirty ? '.dirty' : ''}`;
fs.writeFileSync(path.join(root, 'BUILD.json'), JSON.stringify({ id: buildId, builtAt: new Date().toISOString() }) + '\n');

const include = ['BUILD.json', 'CHANGELOG.md', 'server.js', 'app.js', 'index.js', 'package.json', 'package-lock.json', '.env.example', 'README.md', 'src', 'public', 'docs', 'scripts/backup.mjs', 'scripts/import-feed.mjs', 'scripts/doctor.mjs', 'scripts/live-check.mjs', 'scripts/package.json'];
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
for (const old of fs.readdirSync(out)) if (/^modaward-.*\.zip$/.test(old)) fs.unlinkSync(path.join(out, old)); // only the newest zip stays, so there is nothing to mix up
const file = path.join(out, `modaward-${pkg.version}-${sha}${dirty ? '-dirty' : ''}.zip`);

const zip = spawnSync('zip', ['-rq', file, ...include, '-x', '*.DS_Store', '-x', '*/node_modules/*'], { cwd: root, stdio: 'inherit' });
if (zip.error || zip.status !== 0) {
  console.error('The `zip` command is required to build the archive (install it, or upload the folder via Git instead).');
  process.exit(1);
}
const size = fs.statSync(file).size;
console.log(`\nBuilt ${path.relative(root, file)} (${(size / 1024 / 1024).toFixed(2)} MB), build ${buildId}`);
