#!/usr/bin/env node
/**
 * Import an affiliate product feed into the catalogue.
 *
 *   node scripts/import-feed.mjs --retailer hm --file feed.csv
 *   node scripts/import-feed.mjs --retailer zara --file feed.json --full-sync
 *   node scripts/import-feed.mjs --retailer uniqlo --file feed.csv --map title=product_name --dry-run
 *
 * Options
 *   --retailer <id>     one of the ids in src/shop/retailers.js (required)
 *   --file <path>       CSV/TSV/pipe-delimited or JSON (array, or { products: [] }) (required)
 *   --map a=b,c=d       override column mapping: field=column (fields: sku,title,url,image,price,color,gender,category,brand)
 *   --full-sync         products missing from this feed are marked out of stock
 *   --dry-run           parse and report, write nothing
 *   --limit <n>         import at most n rows
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db/index.js';
import { createCatalog } from '../src/shop/catalog.js';
import { rowsFromText, mapFeed } from '../src/shop/feed.js';
import { RETAILER_IDS } from '../src/shop/retailers.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const retailer = opt('retailer');
const file = opt('file');
if (!retailer || !file || flag('help')) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n').replace(/^ \*\/?\s?/gm, ''));
  process.exit(retailer && file ? 0 : 1);
}
if (!RETAILER_IDS.includes(retailer)) {
  console.error(`Unknown retailer "${retailer}". Choose one of: ${RETAILER_IDS.join(', ')}`);
  process.exit(1);
}

const map = Object.fromEntries((opt('map') || '').split(',').filter(Boolean).map((p) => p.split('=')));
const text = fs.readFileSync(path.resolve(file), 'utf8');
const rows = rowsFromText(text, { format: /\.json$/i.test(file) ? 'json' : 'auto' });

const { products, skipped } = mapFeed(rows, { retailer, map, limit: opt('limit') ? Number(opt('limit')) : Infinity });
console.log(`Read ${rows.length} rows → ${products.length} usable products, ${skipped.length} skipped.`);

const reasons = new Map();
for (const s of skipped) {
  const key = s.reason.replace(/"[^"]*"/g, '"…"');
  reasons.set(key, (reasons.get(key) || 0) + 1);
}
for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  skipped ${String(n).padStart(5)} × ${reason}`);

const byType = {};
for (const p of products) byType[p.type] = (byType[p.type] || 0) + 1;
console.log('By type:', Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', '));

if (flag('dry-run')) {
  console.log('Dry run: nothing written.');
  process.exit(0);
}

const config = loadConfig();
const db = await openDb(path.join(config.dataDir, 'modaward.db'));
const catalog = createCatalog(db);
const started = Math.floor(Date.now() / 1000) - 1;
const { inserted, updated } = catalog.upsert(products);
console.log(`Catalogue updated: ${inserted} added, ${updated} updated.`);
if (flag('full-sync')) console.log(`Marked ${catalog.markMissingOutOfStock(retailer, started)} missing products out of stock.`);
console.log('Catalogue now:', catalog.byRetailer().map((r) => `${r.retailer} ${r.n}`).join(', ') || 'empty');
db.close();
