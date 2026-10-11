#!/usr/bin/env node
/**
 * Turns the app screenshots into the small WebP pictures the website's front page shows (public/img/landing/).
 *
 *   node mobile/store/make-screenshots.mjs dist/store-screenshots      (makes the screenshots first)
 *   node mobile/store/make-landing-images.mjs [screenshotsFolder]       (default: dist/store-screenshots)
 *
 * Uses the same image tool as the app icons: run `cd mobile/tools && npm install` once if it is missing.
 * Re-run both after any visible change to the app, then commit the new pictures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const from = path.resolve(process.argv[2] || path.join(repo, 'dist', 'store-screenshots'));
const dir = path.join(from, 'Apple', 'iphone-6.9in', 'screens-only');
const out = path.join(repo, 'public', 'img', 'landing');

let sharp;
try {
  sharp = createRequire(path.join(here, '..', 'tools', 'package.json'))('sharp');
} catch {
  console.error('The image tool is missing. Run:  cd mobile/tools && npm install');
  process.exit(1);
}
if (!fs.existsSync(dir)) {
  console.error(`No screenshots in ${dir}. Run node mobile/store/make-screenshots.mjs first.`);
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
let total = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
  const id = file.replace(/^\d+-/, '').replace(/\.png$/, '');
  const target = path.join(out, `${id}.webp`);
  await sharp(path.join(dir, file)).resize({ width: 540 }).webp({ quality: 78, effort: 6 }).toFile(target);
  const size = fs.statSync(target).size;
  total += size;
  console.log(`public/img/landing/${id}.webp  ${(size / 1024).toFixed(0)} KB`);
}
console.log(`${(total / 1024).toFixed(0)} KB in all`);
