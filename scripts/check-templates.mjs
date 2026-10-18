#!/usr/bin/env node
/**
 * Checks the catalogue-look templates and reports which garment types still have none.
 *   npm run template:check            problems fail; missing types are listed
 *   npm run template:check -- --strict   missing types fail too
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexProblems, coverage, templateFile } from '../src/shared/template-index.js';
import { CATEGORIES, CATEGORY_IDS } from '../src/shared/taxonomy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.TEMPLATES_DIR || path.join(root, 'public', 'templates');
const indexPath = path.join(dir, 'index.json');
const strict = process.argv.includes('--strict');

const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : { templates: [] };
const problems = indexProblems(index);

/** PNG header: width and height live in the first chunk, colour type in byte 25. */
function pngInfo(file) {
  const b = fs.readFileSync(file);
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colour: b[25], bytes: b.length };
}
for (const e of index.templates ?? []) {
  const file = path.join(dir, path.relative(path.join('templates'), templateFile(e)));
  if (!fs.existsSync(file)) {
    problems.push(`${e.type}/${e.id}: the picture ${path.relative(root, file)} is missing`);
    continue;
  }
  const info = pngInfo(file);
  if (!info) problems.push(`${e.type}/${e.id}: not a PNG`);
  else {
    if (info.colour !== 6) problems.push(`${e.type}/${e.id}: needs a transparent PNG (RGBA)`);
    if (info.width < 300 || info.height < 300) problems.push(`${e.type}/${e.id}: only ${info.width}x${info.height}; at least 300 pixels each way`);
    if (info.width > 1600 || info.height > 1600) problems.push(`${e.type}/${e.id}: ${info.width}x${info.height} is bigger than needed (1200 is plenty)`);
    if (info.bytes > 1_200_000) problems.push(`${e.type}/${e.id}: ${(info.bytes / 1e6).toFixed(1)} MB is heavy for a phone`);
  }
}
const uncredited = (index.templates ?? []).filter((e) => !e.credit).map((e) => `${e.type}/${e.id}`);
const known = new Set((index.templates ?? []).map((e) => path.join(e.type, `${e.id}.png`)));
if (fs.existsSync(dir)) {
  for (const t of fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of fs.readdirSync(path.join(dir, t.name))) if (!known.has(path.join(t.name, f))) problems.push(`${t.name}/${f}: not listed in index.json`);
  }
}

const { have, missing } = coverage(index);
console.log(`Templates: ${index.templates?.length ?? 0} for ${have.length} of ${have.length + missing.length} garment types.`);
for (const cat of CATEGORY_IDS) {
  const mine = [...have, ...missing].filter((t) => t.category === cat);
  console.log(`\n${CATEGORIES[cat].label}`);
  for (const t of mine) console.log(`  ${t.count ? '✓' : '·'} ${t.id.padEnd(16)} ${t.count ? `${t.count} template${t.count > 1 ? 's' : ''}` : 'none yet'}`);
}
if (uncredited.length) console.warn(`\nNo credit recorded (where the photo came from and its licence): ${uncredited.join(', ')}. Add --source, --author and --license when adding a template.`);
if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length > 1 ? 's' : ''}:\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
if (strict && missing.length) {
  console.error(`\n${missing.length} garment types have no template.`);
  process.exit(1);
}
