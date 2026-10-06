/**
 * Builds the pool of purchasable pieces the shopping engine searches over, honouring every hard
 * rule from the profile: department, "never suggest" tags, avoided colours and patterns, plus
 * what the weather and occasion make sensible.
 */
import { TYPES, TYPE_IDS, withDefaults, OCCASIONS } from '../shared/taxonomy.js';
import { colorRole, hexToHsl, swatch, colorName } from '../shared/color.js';
import { ARCHETYPE_IDS } from '../shared/taxonomy.js';
import { specsForType } from './specs.js';
import { rng } from '../engine/rng.js';

const WOMEN_ONLY = new Set(['skirt', 'dress', 'sundress', 'knitdress', 'eveningdress', 'jumpsuit', 'blouse', 'heels', 'flats']);

/** Types and descriptor words each "never" tag rules out. */
const NEVER_RULES = {
  sleeveless: { types: ['tank'] },
  shorts: { types: ['shorts'] },
  heels: { types: ['heels'] },
  synthetics: { types: ['sportstop', 'fleece', 'puffer', 'joggers', 'leggings', 'runners'], words: ['polyester', 'nylon', 'performance', 'moisture'] },
  wool: { types: ['wool-coat'], words: ['wool', 'merino', 'cashmere'] },
  leather: { types: ['loafers', 'dressshoes', 'chelsea'], words: ['leather'] },
  graphic: { patterns: ['graphic'], words: ['graphic'] },
  skinny: { words: ['skinny'] },
  crop: { words: ['crop'] },
  logos: { words: ['logo'] },
  bright: { bright: true }
};

const ensureArray = (v) => (Array.isArray(v) ? v : []);

/** @returns {(piece:object)=>boolean} true when the piece is allowed */
export function allowedBy(profile) {
  const style = profile.style || {};
  const dept = profile.department || 'unisex';
  const never = ensureArray(style.never).map((n) => NEVER_RULES[n]).filter(Boolean);
  const avoidedColors = new Set(ensureArray(style.avoidedColors));
  const avoidedPatterns = new Set(ensureArray(style.avoidedPatterns));

  return (piece) => {
    if (dept === 'men' && WOMEN_ONLY.has(piece.type)) return false;
    if (avoidedColors.has(piece.colorName)) return false;
    if (avoidedPatterns.has(piece.pattern)) return false;
    const text = `${piece.descriptor || ''} ${piece.name || ''}`.toLowerCase();
    for (const rule of never) {
      if (rule.types?.includes(piece.type)) return false;
      if (rule.patterns?.includes(piece.pattern)) return false;
      if (rule.words?.some((w) => text.includes(w))) return false;
      if (rule.bright) {
        const { s, l } = hexToHsl(piece.color);
        if (colorRole(piece.color) === 'accent' && s > 0.6 && l > 0.35 && l < 0.8) return false;
      }
    }
    return true;
  };
}

/** Types that cannot make sense at this temperature range. */
function weatherAllows(type, ref) {
  const t = TYPES[type];
  if (ref.minFeels < 8 && (type === 'shorts' || type === 'sandals' || type === 'sundress' || type === 'tank')) return false;
  if (ref.maxFeels > 27 && (t.warmth >= 4 && t.category !== 'shoes')) return false;
  if (ref.maxFeels > 27 && ['boots', 'waterproofboots', 'chelsea'].includes(type)) return false;
  if (ref.minFeels > 16 && ['parka', 'puffer', 'wool-coat', 'scarf', 'beanie', 'gloves'].includes(type)) return false;
  return true;
}

const FIT_WORDS = {
  tops: { fitted: 'slim fit', relaxed: 'relaxed fit', oversized: 'oversized' },
  bottoms: { skinny: 'skinny', slim: 'slim', relaxed: 'relaxed', wide: 'wide leg' }
};

/** Search phrase a person would type for a spec piece. */
export function queryFor(piece, profile) {
  const dept = profile.department === 'men' ? "men's" : profile.department === 'women' ? "women's" : '';
  let fit = '';
  if (piece.category === 'top' && ['tee', 'longsleeve', 'shirt', 'polo', 'sweater'].includes(piece.type)) fit = FIT_WORDS.tops[profile.fit?.tops] ?? '';
  if (piece.category === 'bottom' && ['jeans', 'chinos', 'trousers'].includes(piece.type)) fit = FIT_WORDS.bottoms[profile.fit?.bottoms] ?? '';
  if (/wide leg|slim|skinny|relaxed|oversized/.test(piece.descriptor || '')) fit = '';
  const color = piece.colorName === 'denim' ? 'dark wash' : piece.colorName === 'light denim' ? 'light wash' : piece.colorName;
  return [dept, fit, piece.descriptor, color].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Which archetypes to draw spec pieces from, strongest first. */
export function activeArchetypes(profile) {
  const weights = profile.style?.archetypes || {};
  const ranked = ARCHETYPE_IDS.filter((a) => (weights[a] ?? 0) >= 0.45).sort((a, b) => weights[b] - weights[a]);
  return ranked.length ? ranked : ['classic', 'minimal', 'casual'];
}

/**
 * @param {object} args
 * @param {object} args.profile
 * @param {object[]} [args.products]  catalog rows already mapped by `productToPiece`
 * @param {object} args.ref           weather reference context (minFeels/maxFeels)
 * @param {string} args.occasion
 * @param {number|string} [args.seed]
 * @param {number} [args.perType]     cap on spec pieces per type
 */
export function buildPool({ profile, products = [], ref, occasion, seed = 0, perType = 14 }) {
  const allowed = allowedBy(profile);
  const archetypes = new Set(activeArchetypes(profile));
  const liked = ensureArray(profile.style?.likedColors);
  const target = OCCASIONS[occasion]?.formality ?? 2.5;
  const rand = rng(typeof seed === 'number' ? seed : [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7));
  const pool = [];

  for (const typeId of TYPE_IDS) {
    const type = TYPES[typeId];
    if (type.category === 'accessory' && !['scarf', 'beanie', 'gloves', 'sunglasses', 'umbrella', 'belt', 'watch', 'bag'].includes(typeId)) continue;
    if (!weatherAllows(typeId, ref)) continue;
    if (Math.abs(type.formality - target) > 2.4) continue;

    const specs = specsForType(typeId, liked).filter((s) => archetypes.has(s.style));
    const sample = specs.length > perType ? specs.map((s) => ({ s, r: rand() })).sort((a, b) => a.r - b.r).slice(0, perType).map((x) => x.s) : specs;
    for (const spec of sample) {
      const piece = withDefaults({
        id: spec.id,
        name: `${spec.colorName} ${spec.descriptor}`.replace(/^./, (c) => c.toUpperCase()),
        type: typeId,
        color: spec.color,
        pattern: spec.pattern,
        styles: [...new Set([spec.style, ...type.styles])].slice(0, 3)
      });
      piece.source = 'spec';
      piece.colorName = spec.colorName;
      piece.descriptor = spec.descriptor;
      if (allowed(piece)) pool.push(piece);
    }
  }

  for (const product of products) {
    if (!weatherAllows(product.type, ref)) continue;
    if (Math.abs(TYPES[product.type].formality - target) > 2.4) continue;
    if (allowed(product)) pool.push(product);
  }
  return pool;
}

/** Map a `catalog_products` row to an engine-compatible piece. */
export function productToPiece(row) {
  const type = TYPES[row.type];
  if (!type) return null;
  const hex = swatch(row.color)?.hex ?? (/^#[0-9a-f]{6}$/i.test(row.color) ? row.color : null);
  if (!hex) return null;
  const piece = withDefaults({
    id: `prod:${row.id}`,
    name: row.title,
    type: row.type,
    color: hex,
    pattern: row.pattern || 'solid',
    brand: row.retailer
  });
  piece.source = 'product';
  piece.colorName = colorName(hex);
  piece.descriptor = row.title;
  piece.retailerId = row.retailer;
  piece.product = { id: row.id, title: row.title, image: row.image_url, url: row.url, priceCents: row.price_cents, currency: row.currency, brand: row.brand, sku: row.sku };
  return piece;
}
