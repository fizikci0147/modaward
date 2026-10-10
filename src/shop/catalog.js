/**
 * Product catalogue backed by the `catalog_products` table, filled from affiliate-network
 * product feeds (see scripts/import-feed.mjs). Products carry the retailer's own photo, price
 * and tracking link, which is what makes collages of real clothes possible.
 */
import { now } from '../db/index.js';
import { productToPiece } from './pool.js';
import { rng } from '../engine/rng.js';
import { hexToRgb, swatch, nearestSwatch } from '../shared/color.js';

const GENDERS = { men: ['men', 'unisex'], women: ['women', 'unisex'], unisex: ['men', 'women', 'unisex'] };

const productRow = (r) => ({
  id: r.id, retailer: r.retailer, sku: r.sku, title: r.title, brand: r.brand, url: r.url, imageUrl: r.image_url,
  priceCents: r.price_cents, currency: r.currency, category: r.category, type: r.type, color: r.color, gender: r.gender,
  inStock: Boolean(r.in_stock), updatedAt: r.updated_at
});

/** @param {import('../db/index.js').Db} db */
export function createCatalog(db) {
  const isEmpty = () => db.get('SELECT 1 AS x FROM catalog_products LIMIT 1') === undefined;

  return {
    isEmpty,
    count: () => db.get('SELECT COUNT(*) AS n FROM catalog_products WHERE in_stock = 1').n,
    byRetailer: () => db.all('SELECT retailer, COUNT(*) AS n FROM catalog_products WHERE in_stock = 1 GROUP BY retailer ORDER BY n DESC'),

    /** A page of products for the admin screen, newest first. */
    list({ retailer, q, limit = 40, offset = 0 } = {}) {
      const where = [];
      const args = [];
      if (retailer) (where.push('retailer = ?'), args.push(retailer));
      if (q) {
        where.push("(title LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')");
        const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        args.push(like, like);
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = db.get(`SELECT COUNT(*) AS n FROM catalog_products ${clause}`, ...args).n;
      const rows = db.all(`SELECT * FROM catalog_products ${clause} ORDER BY updated_at DESC, id LIMIT ? OFFSET ?`, ...args, limit, offset);
      return { total, products: rows.map(productRow) };
    },
    setStock: (id, inStock) => db.run('UPDATE catalog_products SET in_stock = ?, updated_at = ? WHERE id = ?', inStock ? 1 : 0, now(), id).changes,
    remove: (id) => db.run('DELETE FROM catalog_products WHERE id = ?', id).changes,

    /** Insert or update products. Returns counts. */
    upsert(rows) {
      let inserted = 0;
      let updated = 0;
      db.transaction(() => {
        for (const r of rows) {
          const id = `${r.retailer}:${r.sku}`;
          const exists = db.get('SELECT 1 AS x FROM catalog_products WHERE id = ?', id);
          db.run(
            `INSERT INTO catalog_products (id,retailer,sku,title,brand,url,image_url,price_cents,currency,category,type,color,gender,pattern,keywords,in_stock,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(id) DO UPDATE SET title=excluded.title, brand=excluded.brand, url=excluded.url, image_url=excluded.image_url,
               price_cents=excluded.price_cents, currency=excluded.currency, category=excluded.category, type=excluded.type, color=excluded.color,
               gender=excluded.gender, pattern=excluded.pattern, keywords=excluded.keywords, in_stock=excluded.in_stock, updated_at=excluded.updated_at`,
            id, r.retailer, r.sku, r.title, r.brand ?? '', r.url, r.imageUrl, r.priceCents ?? null, r.currency ?? 'USD', r.category, r.type, r.color,
            r.gender ?? 'unisex', r.pattern ?? 'solid', r.keywords ?? '', r.inStock === false ? 0 : 1, now()
          );
          if (exists) updated += 1;
          else inserted += 1;
        }
      });
      return { inserted, updated };
    },

    /** After a full feed import, anything the retailer no longer lists is marked out of stock. */
    markMissingOutOfStock(retailer, sinceTs) {
      return db.run('UPDATE catalog_products SET in_stock = 0 WHERE retailer = ? AND updated_at < ? AND in_stock = 1', retailer, sinceTs).changes;
    },

    /**
     * Products as engine pieces for the pool, sampled per type so no type floods the search.
     * @param {{department:string, types:string[], retailers?:string[], perType?:number, seed?:number}} opts
     */
    pieces({ department, types, retailers, perType = 24, seed = 1 }) {
      if (isEmpty() || !types.length) return [];
      const rand = rng(seed);
      const genders = GENDERS[department] ?? GENDERS.unisex;
      const out = [];
      for (const type of types) {
        const rows = db.all(
          `SELECT * FROM catalog_products WHERE type = ? AND in_stock = 1 AND gender IN (${genders.map(() => '?').join(',')}) LIMIT 400`,
          type,
          ...genders
        );
        const filtered = retailers?.length ? rows.filter((r) => retailers.includes(r.retailer)) : rows;
        const sample = filtered.map((r) => ({ r, k: rand() })).sort((a, b) => a.k - b.k).slice(0, perType);
        for (const { r } of sample) {
          const piece = productToPiece(r);
          if (piece) out.push(piece);
        }
      }
      return out;
    },

    /**
     * Find the best real product for a spec piece at a given retailer, or null.
     * @param {{type:string, color:string, colorName:string, descriptor?:string}} spec
     * @param {{retailer:string, department:string, maxPriceCents?:number}} opts
     */
    match(spec, { retailer, department, maxPriceCents }) {
      const genders = GENDERS[department] ?? GENDERS.unisex;
      const rows = db.all(
        `SELECT * FROM catalog_products WHERE retailer = ? AND type = ? AND in_stock = 1 AND gender IN (${genders.map(() => '?').join(',')}) LIMIT 300`,
        retailer,
        spec.type,
        ...genders
      );
      if (!rows.length) return null;
      const words = new Set((spec.descriptor || '').toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      const want = hexToRgb(spec.color);
      let best = null;
      let bestScore = 0.35; // below this, a product is not close enough to claim it is the same piece
      for (const r of rows) {
        const hex = swatch(r.color)?.hex ?? (/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : nearestSwatch('#888888').hex);
        const rgb = hexToRgb(hex);
        const dist = Math.hypot(rgb[0] - want[0], rgb[1] - want[1], rgb[2] - want[2]) / 441;
        let score = 0.6 * (1 - Math.min(1, dist * 2.2));
        if (r.color === spec.colorName) score += 0.25;
        const text = `${r.title} ${r.keywords}`.toLowerCase();
        let hits = 0;
        for (const w of words) if (text.includes(w)) hits += 1;
        score += 0.15 * (words.size ? hits / words.size : 0);
        if (maxPriceCents && r.price_cents && r.price_cents > maxPriceCents) score -= 0.25;
        if (score > bestScore) {
          bestScore = score;
          best = r;
        }
      }
      return best;
    }
  };
}
