/**
 * Which retailer should supply each piece?
 *
 * Mix mode picks the best retailer per piece (an H&M top with Banana Republic trousers);
 * single mode picks one retailer that carries everything in the look. Scoring blends:
 *   style fit · budget fit · category specialism · the person's chosen stores and brand loves.
 */
import { RETAILERS, retailerById } from './retailers.js';
import { budgetTier } from '../shared/profile.js';

const TIER = { value: 1, mid: 2, premium: 3 };

/** Types each retailer is best known for (a modest bonus, not a hard rule). */
const SPECIALTY = {
  uniqlo: ['tee', 'longsleeve', 'sweater', 'cardigan', 'puffer', 'jeans', 'shirt', 'polo'],
  hm: ['tee', 'hoodie', 'dress', 'sundress', 'joggers', 'cargo', 'tank', 'blouse'],
  gap: ['jeans', 'hoodie', 'tee', 'denimjacket', 'chinos', 'sweater'],
  oldnavy: ['jeans', 'tee', 'hoodie', 'joggers', 'leggings', 'shorts'],
  target: ['tee', 'leggings', 'joggers', 'sundress', 'sneakers', 'bag'],
  asos: ['cargo', 'hoodie', 'bomber', 'sneakers', 'dress', 'jeans'],
  zara: ['blazer', 'trousers', 'wool-coat', 'dress', 'skirt', 'trench', 'blouse'],
  mango: ['blazer', 'trousers', 'dress', 'skirt', 'trench', 'blouse', 'jumpsuit'],
  madewell: ['jeans', 'tee', 'denimjacket', 'sundress', 'cardigan', 'skirt'],
  bananarepublic: ['chinos', 'trousers', 'blazer', 'shirt', 'loafers', 'trench', 'wool-coat', 'sweater', 'polo'],
  jcrew: ['chinos', 'polo', 'sweater', 'blazer', 'loafers', 'shirt', 'cardigan'],
  everlane: ['tee', 'sweater', 'trousers', 'flats', 'jeans', 'shirt'],
  nike: ['runners', 'joggers', 'hoodie', 'sportstop', 'leggings', 'sneakers', 'shorts', 'fleece'],
  nordstrom: ['wool-coat', 'boots', 'dressshoes', 'blazer', 'chelsea', 'heels', 'parka', 'trench']
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** How well a retailer's character matches the person's style weights, 0–1. */
function styleFit(retailer, archetypes) {
  const entries = Object.entries(archetypes || {}).filter(([, w]) => w > 0.3);
  if (!entries.length) return 0.6;
  let num = 0;
  let den = 0;
  for (const [a, w] of entries) {
    num += w * (retailer.styles[a] ?? 0.15);
    den += w;
  }
  return den ? num / den : 0.6;
}

/** @param {object} profile */
export function retailerPrefs(profile) {
  const style = profile.style || {};
  return {
    dept: profile.department || 'unisex',
    tier: TIER[budgetTier(profile)],
    chosen: new Set(style.stores || []),
    love: new Set((style.brands?.love || []).map(norm)),
    avoid: new Set((style.brands?.avoid || []).map(norm)),
    archetypes: style.archetypes || {}
  };
}

/** Retailers the person has not ruled out (department and brand avoids). */
export function baseRetailers(prefs) {
  return RETAILERS.filter((r) => !prefs.avoid.has(norm(r.name)) && !prefs.avoid.has(norm(r.id)) && (prefs.dept === 'unisex' || r.departments.includes(prefs.dept)));
}

/** Retailers to prefer: the person's chosen stores when they picked any, otherwise everything allowed. */
export function eligibleRetailers(prefs) {
  const base = baseRetailers(prefs);
  const chosen = base.filter((r) => prefs.chosen.has(r.id));
  return chosen.length ? chosen : base;
}

/** Score of one retailer for one piece (higher is better). Returns -Infinity if it cannot supply it. */
export function scoreRetailer(retailer, piece, prefs) {
  if (!retailer.carries.includes(piece.category)) return -Infinity;
  const tierGap = Math.abs(TIER[retailer.tier] - prefs.tier);
  let score = 0.38 * styleFit(retailer, prefs.archetypes);
  score += 0.27 * (1 - tierGap / 2);
  score += 0.2 * (SPECIALTY[retailer.id]?.includes(piece.type) ? 1 : 0);
  score += prefs.chosen.has(retailer.id) ? 0.1 : 0;
  score += prefs.love.has(norm(retailer.name)) || prefs.love.has(norm(retailer.id)) ? 0.15 : 0;
  return score;
}

/**
 * Assign a retailer to every piece of a look.
 * Owned pieces and catalogue products keep their own source.
 *
 * @param {object[]} pieces
 * @param {object} profile
 * @param {'mix'|'single'} mode
 * @returns {Map<string, object>} piece id → retailer
 */
export function assignRetailers(pieces, profile, mode = 'mix') {
  const prefs = retailerPrefs(profile);
  const eligible = eligibleRetailers(prefs);
  const result = new Map();
  const buy = pieces.filter((p) => p.source !== 'owned');

  // products are already tied to a retailer
  for (const p of buy) if (p.source === 'product') result.set(p.id, retailerById(p.retailerId));
  const specs = buy.filter((p) => p.source === 'spec');
  if (!specs.length) return result;

  if (mode === 'single') {
    const forced = new Set(buy.filter((p) => p.source === 'product').map((p) => p.retailerId));
    const candidates = forced.size === 1 ? [retailerById([...forced][0])] : eligible;
    // a single store only works if it carries everything in the look
    let best = null;
    let bestScore = -Infinity;
    for (const r of candidates) {
      let total = 0;
      for (const p of specs) total += scoreRetailer(r, p, prefs);
      if (total > bestScore) {
        bestScore = total;
        best = r;
      }
    }
    // no single store carries everything (e.g. Nike has no dresses): fall back to mixing
    if (best && Number.isFinite(bestScore)) {
      for (const p of specs) result.set(p.id, best);
      return result;
    }
  }

  // Pieces that none of the person's chosen stores carries (a dress at Nike) may use any other
  // allowed retailer; everything else stays within the chosen stores.
  const everyone = baseRetailers(prefs);
  const uncovered = new Set(specs.filter((p) => !eligible.some((r) => r.carries.includes(p.category))).map((p) => p.id));
  const mayUse = (r, p) => eligible.includes(r) || uncovered.has(p.id);

  const candidatesFor = (p) => (uncovered.has(p.id) ? everyone : eligible).filter((r) => r.carries.includes(p.category));
  // retailers worth considering as a pair member: those that carry at least one of the specs
  const members = [...new Map(specs.flatMap(candidatesFor).map((r) => [r.id, r])).values()];

  // Mix mode: at most two stores per look (one parcel less to track, and the look still blends
  // brands). Try every pair, assign each piece to the better of the two, keep the best total.
  // Products already fix some retailers; those count as members of the pair.
  const fixed = [...new Set(buy.filter((p) => p.source === 'product').map((p) => p.retailerId))].map(retailerById);
  const maxStores = Math.max(2, fixed.length);
  const groups = [];
  if (fixed.length >= maxStores) groups.push(fixed);
  else {
    const free = members.filter((r) => !fixed.some((f) => f.id === r.id));
    for (let i = 0; i < free.length; i++) {
      groups.push([...fixed, free[i]]);
      for (let j = i + 1; j < free.length; j++) if (fixed.length + 2 <= maxStores) groups.push([...fixed, free[i], free[j]]);
    }
  }
  let bestAssign = null;
  let bestTotal = -Infinity;
  for (const group of groups) {
    const assign = new Map();
    let total = 0;
    let ok = true;
    for (const p of specs) {
      let top = null;
      let topScore = -Infinity;
      for (const r of group) {
        if (!mayUse(r, p)) continue;
        const s = scoreRetailer(r, p, prefs);
        if (s > topScore) {
          topScore = s;
          top = r;
        }
      }
      if (!top || !Number.isFinite(topScore)) {
        ok = false;
        break;
      }
      assign.set(p.id, top);
      total += topScore;
    }
    if (ok) {
      // a small bonus for genuinely blending two brands
      total += new Set(assign.values()).size === 2 ? 0.05 : 0;
      if (total > bestTotal) {
        bestTotal = total;
        bestAssign = assign;
      }
    }
  }
  if (bestAssign) for (const [id, r] of bestAssign) result.set(id, r);
  return result;
}

/** Price band symbol for a retailer, honest about being an estimate. */
export const priceBand = (retailer) => ({ value: '$', mid: '$$', premium: '$$$' })[retailer.tier];
