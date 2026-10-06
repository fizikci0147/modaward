/**
 * Looks: complete outfits to buy, in the spirit of a personal stylist's "fix".
 *
 * Two kinds:
 *   • "new"   — head-to-toe looks made entirely of new pieces
 *   • "owned" — one or two new pieces built around items already in the closet
 *
 * Pieces come from real catalogue products (with the retailer's photo, price and link) when a
 * feed is loaded, and from the style-aware spec library otherwise. The same engine that dresses
 * you for the weather scores every look, so each one suits the forecast, the occasion, the
 * colour palette and the taste the person has shown.
 */
import { generate, prepareGarments } from '../engine/outfit.js';
import { buildContext } from '../engine/context.js';
import { normalizePrefs, mainPieces } from '../engine/scoring.js';
import { TasteModel, withTaste } from '../ai/taste.js';
import { hashString, rng } from '../engine/rng.js';
import { TYPES, TYPE_IDS, OCCASIONS, ARCHETYPES } from '../shared/taxonomy.js';
import { colorRole } from '../shared/color.js';
import { budgetTier } from '../shared/profile.js';
import { buildPool, queryFor } from './pool.js';
import { assignRetailers, priceBand } from './assign.js';
import { searchUrl } from './retailers.js';

/** The profile's "what do you dress for" answers → engine occasions. */
const OCCASION_MAP = { work: 'work', casual: 'casual', weekend: 'casual', date: 'evening', travel: 'casual', active: 'active', events: 'formal' };
const OCCASION_NOUN = { work: 'for work', casual: 'for every day', evening: 'for dinner', formal: 'for events', active: 'for the gym' };
export const BUDGET_KEY = { top: 'top', bottom: 'bottom', dress: 'dress', outerwear: 'outerwear', shoes: 'shoes' };

export function shopOccasions(profile) {
  const chosen = [...new Set((profile.lifestyle?.occasions || []).map((o) => OCCASION_MAP[o]).filter(Boolean))];
  if (chosen.length) return chosen;
  return profile.lifestyle?.dressCode === 'business' || profile.lifestyle?.dressCode === 'formal' ? ['work', 'casual'] : ['casual', 'work'];
}

/** The forecast day that best represents the coming days: the median by feels-like temperature. */
export function referenceDay(days) {
  const upcoming = days.slice(0, 5);
  const scored = upcoming.map((d) => ({ d, ctx: buildContext(d) })).sort((a, b) => a.ctx.avgFeels - b.ctx.avgFeels);
  const mid = scored[Math.floor(scored.length / 2)];
  const wetDays = upcoming.filter((d) => buildContext(d).rain !== 'none').length;
  return { day: mid.d, ctx: mid.ctx, wetDays, coldest: Math.min(...scored.map((s) => s.ctx.minFeels)), warmest: Math.max(...scored.map((s) => s.ctx.maxFeels)) };
}

const rangeText = (ctx, units) => {
  const f = (c) => (units === 'imperial' ? Math.round((c * 9) / 5 + 32) : Math.round(c));
  return `${f(ctx.minFeels)}° to ${f(ctx.maxFeels)}°`;
};

const slotOrder = (parts) => {
  const out = [];
  parts.upper.forEach((g, i) => out.push({ slot: i === 0 ? 'top' : 'layer', piece: g }));
  if (parts.dress) out.push({ slot: 'dress', piece: parts.dress });
  if (parts.bottom) out.push({ slot: 'bottom', piece: parts.bottom });
  if (parts.outer) out.push({ slot: 'outerwear', piece: parts.outer });
  if (parts.shoes) out.push({ slot: 'shoes', piece: parts.shoes });
  for (const a of parts.accessories) out.push({ slot: 'accessory', piece: a });
  return out;
};

/** Greedy variety: avoid near-duplicates (same top+bottom types, same signature, overused hero pieces). */
function diversify(results, limit, usedSignatures = new Set(), usedPairs = new Map(), heroes = new Map()) {
  const chosen = [];
  const sigOf = (parts) => [...parts.upper.map((g) => g.type), parts.bottom?.type ?? parts.dress?.type, parts.outer?.type, parts.shoes?.type].join('|');
  const pairOf = (parts) => `${parts.upper[0]?.type ?? 'x'}+${parts.bottom?.type ?? parts.dress?.type}`;
  const heroOf = (parts) => (parts.dress ?? parts.upper[0] ?? parts.bottom)?.id;

  for (const relaxed of [false, true]) {
    for (const r of results) {
      if (chosen.length >= limit) return chosen;
      if (chosen.includes(r)) continue;
      const sig = sigOf(r.parts);
      const pair = pairOf(r.parts);
      const hero = heroOf(r.parts);
      if (usedSignatures.has(sig)) continue;
      if ((usedPairs.get(pair) || 0) >= (relaxed ? 3 : 2)) continue;
      if ((heroes.get(hero) || 0) >= (relaxed ? 3 : 2)) continue;
      // at least half of the main pieces must be new to this selection
      const ids = new Set(mainPieces(r.parts).map((g) => g.id));
      if (!relaxed && chosen.some((c) => [...ids].filter((id) => mainPieces(c.parts).some((g) => g.id === id)).length > ids.size * 0.34)) continue;
      chosen.push(r);
      usedSignatures.add(sig);
      usedPairs.set(pair, (usedPairs.get(pair) || 0) + 1);
      heroes.set(hero, (heroes.get(hero) || 0) + 1);
    }
  }
  return chosen;
}

function paletteOf(parts) {
  const names = [];
  for (const g of [...parts.upper.slice(0, 1), parts.bottom, parts.dress, parts.outer].filter(Boolean)) if (!names.includes(g.colorName)) names.push(g.colorName);
  return names;
}

/** The archetype most strongly expressed by a look, weighted by what the person told us. */
function dominantArchetype(parts, weights) {
  const tally = {};
  for (const g of mainPieces(parts)) for (const s of g.styles || []) tally[s] = (tally[s] || 0) + (weights[s] ?? 0.5);
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? 'classic';
}

export function pieceCard({ slot, piece }, retailer, ctx) {
  const { profile, catalog, linker, budgetCaps } = ctx;
  const type = TYPES[piece.type];
  const base = { slot, type: piece.type, label: type.label, color: piece.color, colorName: piece.colorName, pattern: piece.pattern, category: piece.category, source: piece.source };

  if (piece.source === 'owned') return { ...base, name: piece.name, ownedId: piece.id, imageUrl: piece.imageUrl ?? null, retailer: null };

  const cap = budgetCaps[piece.category];
  let product = piece.product ?? null;
  if (!product && catalog) {
    const row = catalog.match(piece, { retailer: retailer.id, department: profile.department, maxPriceCents: cap ? cap * 100 : undefined });
    if (row) product = { id: row.id, title: row.title, image: row.image_url, url: row.url, priceCents: row.price_cents, currency: row.currency, brand: row.brand, sku: row.sku };
  }
  const retailerInfo = { id: retailer.id, name: retailer.name, band: priceBand(retailer) };
  if (product) {
    return {
      ...base,
      name: product.title,
      source: 'product',
      retailer: retailerInfo,
      product: { title: product.title, image: product.image, priceCents: product.priceCents, currency: product.currency, brand: product.brand },
      link: linker.link(retailer.id, product.url, 'product')
    };
  }
  const query = queryFor(piece, profile);
  return { ...base, source: 'spec', name: piece.name, retailer: retailerInfo, query, link: linker.link(retailer.id, searchUrl(retailer, query), 'search') };
}

function buildReasons({ parts, scores, kind, occasion, ref, units, profile, taste, cards }) {
  const reasons = [];
  const weights = profile.style?.archetypes || {};
  const arch = dominantArchetype(parts, weights);
  if ((weights[arch] ?? 0) >= 0.6) reasons.push(`Matches your ${ARCHETYPES[arch].label.toLowerCase()} style.`);
  const palette = paletteOf(parts);
  if (scores.color.note && scores.color.score >= 0.8) {
    const names = palette.slice(0, 3);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
    reasons.push(`${list.replace(/^./, (c) => c.toUpperCase())}: ${scores.color.note.charAt(0).toLowerCase() + scores.color.note.slice(1)}.`);
  }
  reasons.push(`Right for the week's ${rangeText(ref, units)}${ref.rain !== 'none' ? ', with a chance of rain covered' : ''}.`);
  if (kind === 'owned') {
    const owned = cards.filter((c) => c.source === 'owned');
    if (owned.length) reasons.unshift(`Built around your ${owned.map((o) => o.name.toLowerCase()).slice(0, 2).join(' and ')}.`);
  }
  if (taste && taste.confidence >= 0.3 && taste.score(mainPieces(parts)) >= 0.62) reasons.push('Similar to looks you have loved.');
  const caps = profile.budget || {};
  const bought = cards.filter((c) => c.source !== 'owned' && c.product?.priceCents);
  if (bought.length && bought.every((c) => !caps[BUDGET_KEY[c.category]] || c.product.priceCents <= caps[BUDGET_KEY[c.category]] * 100)) reasons.push('Every priced piece is within your budget.');
  return reasons.slice(0, 4);
}

/**
 * @param {object} args
 * @param {object} args.profile
 * @param {object[]} args.wardrobe        owned garments (API shape)
 * @param {object[]} args.days            forecast days
 * @param {ReturnType<import('./catalog.js').createCatalog>|null} args.catalog
 * @param {ReturnType<import('./links.js').createLinker>} args.linker
 * @param {object} [args.tasteState]      stored taste model JSON
 * @param {'new'|'owned'|'both'} [args.kind]
 * @param {'mix'|'single'} [args.storeMode]
 * @param {string[]} [args.occasions]
 * @param {number|string} [args.seed]
 * @param {number} [args.limit]
 * @param {Set<string>} [args.blocked]    look keys the person rejected
 */
export function buildLooks(args) {
  const { profile, wardrobe, days, catalog, linker } = args;
  const units = profile.units || 'imperial';
  const kind = args.kind || 'both';
  const storeMode = args.storeMode || (profile.style?.mixStores === false ? 'single' : 'mix');
  const limit = args.limit ?? 18;
  const occasions = args.occasions?.length ? args.occasions : shopOccasions(profile);
  const taste = args.tasteState?.n ? new TasteModel(args.tasteState) : null;
  const prefs = withTaste(normalizePrefs(profile), taste);
  const ref = referenceDay(days);
  const seed = hashString(`${args.seed ?? 'looks'}`);
  const rand = rng(seed);

  const owned = prepareGarments(wardrobe).filter((g) => g.category !== 'accessory').map((g) => ({ ...g, source: 'owned' }));
  const products = catalog && !catalog.isEmpty() ? catalog.pieces({ department: profile.department, types: TYPE_IDS.filter((t) => TYPES[t].category !== 'accessory'), retailers: profile.style?.stores, seed }) : [];
  const budgetCaps = Object.fromEntries(Object.entries(BUDGET_KEY).map(([cat, key]) => [cat, profile.budget?.[key]]));
  const cardCtx = { profile, catalog, linker, budgetCaps };

  const kinds = kind === 'both' ? ['new', 'owned'] : [kind];
  const totalSlots = occasions.length * kinds.length;
  const perBucket = Math.max(2, Math.ceil(limit / totalSlots));
  const usedSig = new Set();
  const usedPairs = new Map();
  const heroes = new Map();
  const selected = [];

  for (const occasion of occasions) {
    for (const k of kinds) {
      if (k === 'owned' && !owned.length) continue;
      const pool = buildPool({ profile, products, ref: ref.ctx, occasion, seed: `${seed}|${occasion}` });
      const garments = k === 'owned' ? [...pool, ...owned] : pool;
      if (!garments.length) continue;

      const tier = budgetTier(profile);
      const bonus = (parts) => {
        const pieces = [...mainPieces(parts), ...(parts.outer ? [parts.outer] : [])];
        let b = 0;
        for (const p of pieces) {
          if (p.source === 'product' && p.product.priceCents) {
            const cap = budgetCaps[p.category];
            if (cap && p.product.priceCents > cap * 100) b -= 0.07 * Math.min(2, p.product.priceCents / (cap * 100) - 1 + 0.5);
          }
          // real products make for richer, more trustworthy cards
          if (p.source === 'product') b += 0.012;
        }
        if (k === 'owned') b += 0.03 * pieces.filter((p) => p.source === 'owned').length;
        return b;
      };
      const accept = (parts) => {
        const pieces = [...mainPieces(parts), ...(parts.outer ? [parts.outer] : [])];
        const ownedCount = pieces.filter((p) => p.source === 'owned').length;
        const newCount = pieces.length - ownedCount;
        if (k === 'owned' && (ownedCount < 1 || newCount < 1 || newCount > 2)) return false;
        if (k === 'new' && ownedCount > 0) return false;
        if (storeMode === 'single') {
          const shops = new Set(pieces.filter((p) => p.source === 'product').map((p) => p.retailerId));
          if (shops.size > 1) return false;
        }
        return true;
      };

      const results = generate({
        garments,
        ctx: ref.ctx,
        occasion,
        prefs,
        lastWorn: new Map(),
        avoid: new Map(),
        recentKeys: new Set(),
        rand,
        caps: { tops: 70, bottoms: 45, dresses: 25 },
        accept,
        bonus,
        coreBonus: k === 'owned' ? (core) => 0.1 * ([...core.upper, core.bottom, core.dress].filter((p) => p?.source === 'owned').length) : undefined,
        mustKeep: k === 'owned' ? (g) => g.source === 'owned' : undefined
      });

      const fresh = results.filter((r) => !args.blocked?.has(r.key));
      for (const r of diversify(fresh.slice(0, 220), perBucket, usedSig, usedPairs, heroes)) selected.push({ ...r, occasion, kind: k });
    }
  }

  // Round-robin across (kind × occasion) buckets, strongest bucket first, so the feed alternates
  // between all-new looks and looks built around the closet instead of reading as one block.
  const buckets = new Map();
  for (const r of [...selected].sort((a, b) => b.total - a.total)) {
    const key = `${r.kind}|${r.occasion}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }
  const ordered = [];
  const byStrength = [...buckets.values()].sort((a, b) => b[0].total - a[0].total);
  const newQs = byStrength.filter((q) => q[0].kind === 'new');
  const ownedQs = byStrength.filter((q) => q[0].kind === 'owned');
  const queues = [];
  for (let i = 0; i < Math.max(newQs.length, ownedQs.length); i++) {
    if (newQs[i]) queues.push(newQs[i]);
    if (ownedQs[i]) queues.push(ownedQs[i]);
  }
  while (ordered.length < limit && queues.some((q) => q.length)) for (const q of queues) if (q.length && ordered.length < limit) ordered.push(q.shift());
  const looks = ordered.map((r) => {
    const slots = slotOrder(r.parts);
    const buy = slots.map((s) => s.piece).filter((p) => p.source !== 'owned');
    const retailers = assignRetailers(buy, profile, storeMode);
    const cards = slots.map((s) => {
      const retailer = s.piece.source === 'owned' ? null : retailers.get(s.piece.id);
      return retailer || s.piece.source === 'owned' ? pieceCard(s, retailer, cardCtx) : { slot: s.slot, type: s.piece.type, label: TYPES[s.piece.type].label, color: s.piece.color, colorName: s.piece.colorName, source: 'spec', name: s.piece.name, retailer: null };
    });
    const palette = paletteOf(r.parts);
    const priced = cards.filter((c) => c.source !== 'owned');
    const allPriced = priced.length > 0 && priced.every((c) => c.product?.priceCents);
    const arch = dominantArchetype(r.parts, profile.style?.archetypes || {});
    const store = new Set(priced.map((c) => c.retailer?.id).filter(Boolean));
    return {
      id: hashString(`${r.key}|${r.occasion}|${r.kind}|${storeMode}`).toString(36),
      key: r.key,
      kind: r.kind,
      occasion: r.occasion,
      title: `${palette.slice(0, 2).join(' & ').replace(/^./, (c) => c.toUpperCase())} ${OCCASION_NOUN[r.occasion]}`,
      archetype: arch,
      archetypeLabel: ARCHETYPES[arch].label,
      palette,
      score: Math.round(Math.max(0, Math.min(1, r.total)) * 100),
      pieces: cards,
      newCount: priced.length,
      totalCents: allPriced ? priced.reduce((s, c) => s + c.product.priceCents, 0) : null,
      currency: priced.find((c) => c.product?.currency)?.product.currency ?? 'USD',
      storeCount: store.size,
      singleStore: store.size === 1 ? [...store][0] : null,
      reasons: buildReasons({ parts: r.parts, scores: r.scores, kind: r.kind, occasion: r.occasion, ref: ref.ctx, units, profile, taste, cards })
    };
  });

  return {
    looks,
    reference: { date: ref.day.date, range: rangeText(ref.ctx, units), wetDays: ref.wetDays, coldest: ref.coldest, warmest: ref.warmest },
    occasions,
    storeMode,
    usingProducts: products.length > 0
  };
}

export { colorRole };
