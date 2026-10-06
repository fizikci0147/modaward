#!/usr/bin/env node
/**
 * Static quality gate (run in CI and before packaging):
 *  - every source file parses (server ESM, browser ESM, scripts, tests)
 *  - every browser import resolves to a file that exists
 *  - index.html is CSP-clean: no inline scripts, handlers or style attributes
 *  - manifest icons and service-worker precache entries exist
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(root, p);
const errors = [];
const fail = (m) => errors.push(m);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'data', 'vendor'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const files = [...walk(root)];
const js = files.filter((f) => /\.(m?js)$/.test(f));

// 1. syntax
for (const f of js) {
  try {
    transformSync(fs.readFileSync(f, 'utf8'), { loader: 'js', format: 'esm', sourcefile: rel(f) });
  } catch (e) {
    // server.js is intentionally CommonJS-with-dynamic-import: it is still valid as ESM syntax
    fail(`syntax: ${rel(f)}: ${e.errors?.[0]?.text ?? e.message}`);
  }
}

// 2. browser imports resolve
const browserRoots = [path.join(root, 'public', 'js'), path.join(root, 'src', 'shared')];
const resolveBrowser = (spec, from) => {
  if (/^https?:/.test(spec)) return null;
  if (spec.startsWith('/shared/')) return path.join(root, 'src', spec);
  if (spec.startsWith('/')) return path.join(root, 'public', spec);
  if (spec.startsWith('.')) return path.resolve(path.dirname(from), spec);
  return null;
};
for (const f of js.filter((f) => browserRoots.some((r) => f.startsWith(r)) || f.startsWith(path.join(root, 'public')))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:import|export)\s[^'"`;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|new Worker\(\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1] || m[2] || m[3];
    const target = resolveBrowser(spec, f);
    if (target && !fs.existsSync(target)) fail(`import: ${rel(f)} imports ${spec}, which does not exist`);
  }
}

// 3. HTML is CSP-clean and references real files
for (const file of files.filter((f) => f.startsWith(path.join(root, 'public')) && f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) fail(`html: ${rel(file)} has an inline <script> (blocked by the CSP)`);
  if (/\son[a-z]+\s*=/i.test(html)) fail(`html: ${rel(file)} has an inline event handler`);
  if (/\sstyle\s*=/i.test(html)) fail(`html: ${rel(file)} has a style attribute (blocked by the CSP)`);
  for (const m of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)) if (!fs.existsSync(path.join(root, 'public', m[1]))) fail(`html: ${rel(file)} references missing ${m[1]}`);
}

// 4. manifest + service worker
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));
for (const i of manifest.icons) if (!fs.existsSync(path.join(root, 'public', i.src))) fail(`manifest: missing icon ${i.src}`);
const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
const shell = /const SHELL = \[([^\]]+)\]/.exec(sw)?.[1].match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
if (!shell.length) fail('sw: could not read the precache list');
for (const p of shell) if (p !== '/' && !fs.existsSync(path.join(root, 'public', p))) fail(`sw: precache entry ${p} does not exist`);

// 5. package sanity
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!fs.existsSync(path.join(root, pkg.main))) fail(`package: main ${pkg.main} is missing`);
if (!fs.existsSync(path.join(root, 'src', 'package.json'))) fail('package: src/package.json ({"type":"module"}) is missing');

if (errors.length) {
  console.error(errors.map((e) => `✖ ${e}`).join('\n'));
  console.error(`\n${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`✔ ${js.length} source files parse, browser imports resolve, HTML is CSP-clean, ${shell.length} precache entries and ${manifest.icons.length} icons exist`);
