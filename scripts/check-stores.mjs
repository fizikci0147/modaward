#!/usr/bin/env node
/**
 * Visits every store in the built-in database and reports the ones that no longer answer, so a retired or mistyped
 * address can be fixed in src/shop/store-data.js.
 *
 *   npm run stores:check              check everything (about a minute)
 *   npm run stores:check -- zalando   only stores whose id or name contains "zalando"
 *
 * Needs internet access. Many shops refuse automated requests (a 403 or 429 means the site is there but did not like the
 * request), so only "no answer at all" and 404 are treated as problems; the rest are listed as notes.
 */
import { RETAILERS } from '../src/shop/retailers.js';

const filter = (process.argv[2] || '').toLowerCase();
const stores = RETAILERS.filter((r) => !filter || r.id.includes(filter) || r.name.toLowerCase().includes(filter));
const results = [];
let next = 0;

async function visit(r) {
  const started = Date.now();
  try {
    const res = await fetch(`https://${r.domain}/`, { redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; ModaWardStoreCheck/1.0)' } });
    return { r, status: res.status, final: new URL(res.url).hostname, ms: Date.now() - started };
  } catch (e) {
    return { r, status: 0, error: String(e.cause?.code || e.name || e.message).slice(0, 40), ms: Date.now() - started };
  }
}

async function worker() {
  while (next < stores.length) {
    const r = stores[next++];
    results.push(await visit(r));
    if (results.length % 50 === 0) process.stderr.write(`  ${results.length}/${stores.length}\n`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));

const dead = results.filter((x) => x.status === 0 || x.status === 404 || x.status === 410).sort((a, b) => a.r.id.localeCompare(b.r.id));
const guarded = results.filter((x) => [401, 403, 405, 429, 451].includes(x.status));
const moved = results.filter((x) => x.status && x.status < 400 && !x.final.endsWith(x.r.domain.replace(/^www\./, '')));
console.log(`\nChecked ${results.length} stores: ${results.length - dead.length - guarded.length} answered, ${guarded.length} answered but refused the check, ${dead.length} did not answer.`);
if (dead.length) {
  console.log('\nNo answer (fix or remove in src/shop/store-data.js):');
  for (const x of dead) console.log(`  ${x.r.id.padEnd(22)} ${x.r.domain.padEnd(36)} ${x.status || x.error}`);
}
if (moved.length) {
  console.log('\nAnswered from a different website (the address may have changed):');
  for (const x of moved) console.log(`  ${x.r.id.padEnd(22)} ${x.r.domain} → ${x.final}`);
}
process.exit(dead.length ? 1 : 0);
