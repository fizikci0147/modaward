/**
 * Garment taxonomy shared by the server (validation, engine) and the browser (forms, art).
 *
 * Every garment type carries sensible defaults so a user can add an item by choosing a
 * type and a colour; warmth/formality can then be fine-tuned.
 *
 * warmth    1 (very light) … 5 (very warm)
 * formality 1 (athletic / lounge) … 5 (black tie)
 */

import { L } from './i18n.js';

export const CATEGORIES = Object.freeze({
  top: { label: L('Tops'), plural: 'tops' },
  bottom: { label: L('Bottoms'), plural: 'bottoms' },
  dress: { label: L('Dresses & jumpsuits'), plural: 'dresses' },
  outerwear: { label: L('Outerwear'), plural: 'outerwear' },
  shoes: { label: L('Shoes'), plural: 'shoes' },
  accessory: { label: L('Accessories'), plural: 'accessories' }
});

export const CATEGORY_IDS = Object.freeze(Object.keys(CATEGORIES));

/** Style archetypes used by the quiz, garments and the shopping engine. */
export const ARCHETYPES = Object.freeze({
  minimal: {
    label: L('Minimalist'),
    blurb: L('Clean lines, quiet colours, nothing extra.')
  },
  classic: {
    label: L('Classic'),
    blurb: L('Timeless staples, tailored and polished.')
  },
  casual: {
    label: L('Easy casual'),
    blurb: L('Relaxed, comfortable, effortlessly put together.')
  },
  sporty: {
    label: L('Athleisure'),
    blurb: L('Performance-inspired pieces for a busy day.')
  },
  street: {
    label: L('Streetwear'),
    blurb: L('Oversized fits, sneakers, graphic energy.')
  },
  polished: {
    label: L('Polished'),
    blurb: L('Sharp, dressed-up and work-ready.')
  },
  boho: {
    label: L('Boho & relaxed romantic'),
    blurb: L('Flowy shapes, earthy tones, soft textures.')
  }
});

export const ARCHETYPE_IDS = Object.freeze(Object.keys(ARCHETYPES));

/** Lower-case words for use inside sentences ("Matches your minimalist style"). */
export const ARCHETYPE_WORD = Object.freeze({
  minimal: L('minimalist'),
  classic: L('classic'),
  casual: L('easy casual'),
  sporty: L('athleisure'),
  street: L('streetwear'),
  polished: L('polished'),
  boho: L('boho & relaxed romantic')
});

/**
 * @typedef {object} TypeDef
 * @property {string} id
 * @property {string} label
 * @property {string} category
 * @property {number} warmth
 * @property {number} formality
 * @property {string[]} styles      archetype ids this type naturally belongs to
 * @property {'base'|'mid'|'either'} [layer]  tops only: how the piece layers
 * @property {boolean} [water]      naturally water resistant (rain jackets, rain boots)
 * @property {boolean} [open]       footwear that is open to rain/cold (sandals)
 * @property {string} art           key into the SVG art library
 * @property {string} [accFn]       accessories only: 'cold' | 'sun' | 'rain' | 'style'
 * @property {string} search        retailer search keywords
 */

/** @type {TypeDef[]} */
const T = [
  // ── Tops ──────────────────────────────────────────────────────────────
  { id: 'tee', label: L('T-shirt'), category: 'top', warmth: 1, formality: 1.5, layer: 'base', styles: ['casual', 'minimal', 'street'], art: 'tee', search: 't-shirt' },
  { id: 'tank', label: L('Tank top'), category: 'top', warmth: 1, formality: 1.5, layer: 'base', styles: ['casual', 'sporty'], art: 'tank', search: 'tank top' },
  { id: 'polo', label: L('Polo'), category: 'top', warmth: 1, formality: 3, layer: 'base', styles: ['classic', 'casual'], art: 'polo', search: 'polo shirt' },
  { id: 'longsleeve', label: L('Long-sleeve tee'), category: 'top', warmth: 2, formality: 1.5, layer: 'base', styles: ['casual', 'minimal'], art: 'longsleeve', search: 'long sleeve t-shirt' },
  { id: 'shirt', label: L('Button-up shirt'), category: 'top', warmth: 2, formality: 3.5, layer: 'either', styles: ['classic', 'polished', 'minimal'], art: 'shirt', search: 'button up shirt' },
  { id: 'blouse', label: L('Blouse'), category: 'top', warmth: 1, formality: 3.5, layer: 'base', styles: ['polished', 'classic', 'boho'], art: 'blouse', search: 'blouse' },
  { id: 'sweater', label: L('Sweater'), category: 'top', warmth: 4, formality: 3, layer: 'either', styles: ['classic', 'casual', 'minimal'], art: 'sweater', search: 'crewneck sweater' },
  { id: 'cardigan', label: L('Cardigan'), category: 'top', warmth: 3, formality: 3, layer: 'mid', styles: ['classic', 'boho', 'minimal'], art: 'cardigan', search: 'cardigan' },
  { id: 'hoodie', label: L('Hoodie'), category: 'top', warmth: 3, formality: 1.5, layer: 'either', styles: ['casual', 'street', 'sporty'], art: 'hoodie', search: 'hoodie' },
  { id: 'sportstop', label: L('Athletic top'), category: 'top', warmth: 1, formality: 1, layer: 'base', styles: ['sporty'], art: 'tee', search: 'performance t-shirt' },

  // ── Bottoms ───────────────────────────────────────────────────────────
  { id: 'jeans', label: L('Jeans'), category: 'bottom', warmth: 3, formality: 2, styles: ['casual', 'classic', 'street', 'minimal'], art: 'pants', search: 'jeans' },
  { id: 'chinos', label: L('Chinos'), category: 'bottom', warmth: 2.5, formality: 3, styles: ['classic', 'casual', 'minimal'], art: 'pants', search: 'chino pants' },
  { id: 'trousers', label: L('Dress trousers'), category: 'bottom', warmth: 3, formality: 4.5, styles: ['polished', 'classic', 'minimal'], art: 'pants', search: 'tailored trousers' },
  { id: 'joggers', label: L('Joggers'), category: 'bottom', warmth: 3, formality: 1, styles: ['sporty', 'street', 'casual'], art: 'joggers', search: 'joggers' },
  { id: 'leggings', label: L('Leggings'), category: 'bottom', warmth: 2, formality: 1, styles: ['sporty', 'casual'], art: 'leggings', search: 'leggings' },
  { id: 'shorts', label: L('Shorts'), category: 'bottom', warmth: 1, formality: 1.5, styles: ['casual', 'sporty'], art: 'shorts', search: 'shorts' },
  { id: 'skirt', label: L('Skirt'), category: 'bottom', warmth: 2, formality: 3, styles: ['classic', 'boho', 'polished'], art: 'skirt', search: 'midi skirt' },
  { id: 'cargo', label: L('Cargo pants'), category: 'bottom', warmth: 3, formality: 1.5, styles: ['street', 'casual'], art: 'pants', search: 'cargo pants' },

  // ── Dresses ───────────────────────────────────────────────────────────
  { id: 'sundress', label: L('Sundress'), category: 'dress', warmth: 1, formality: 2.5, styles: ['boho', 'casual'], art: 'dress', search: 'sundress' },
  { id: 'dress', label: L('Day dress'), category: 'dress', warmth: 2, formality: 3.5, styles: ['classic', 'polished', 'boho'], art: 'dress', search: 'day dress' },
  { id: 'knitdress', label: L('Sweater dress'), category: 'dress', warmth: 4, formality: 3, styles: ['classic', 'minimal'], art: 'dress', search: 'sweater dress' },
  { id: 'eveningdress', label: L('Evening dress'), category: 'dress', warmth: 1.5, formality: 4.5, styles: ['polished'], art: 'dress', search: 'cocktail dress' },
  { id: 'jumpsuit', label: L('Jumpsuit'), category: 'dress', warmth: 2, formality: 3, styles: ['polished', 'minimal', 'boho'], art: 'jumpsuit', search: 'jumpsuit' },

  // ── Outerwear ─────────────────────────────────────────────────────────
  { id: 'lightjacket', label: L('Light jacket'), category: 'outerwear', warmth: 2, formality: 2.5, styles: ['casual', 'minimal', 'street'], art: 'jacket', search: 'lightweight jacket' },
  { id: 'denimjacket', label: L('Denim jacket'), category: 'outerwear', warmth: 2, formality: 2, styles: ['casual', 'street', 'boho'], art: 'jacket', search: 'denim jacket' },
  { id: 'bomber', label: L('Bomber jacket'), category: 'outerwear', warmth: 3, formality: 2, styles: ['street', 'casual'], art: 'jacket', search: 'bomber jacket' },
  { id: 'blazer', label: L('Blazer'), category: 'outerwear', warmth: 2, formality: 4.5, styles: ['polished', 'classic'], art: 'blazer', search: 'blazer' },
  { id: 'raincoat', label: L('Rain jacket'), category: 'outerwear', warmth: 2, formality: 2, water: true, styles: ['casual', 'sporty', 'minimal'], art: 'jacket', search: 'waterproof rain jacket' },
  { id: 'trench', label: L('Trench coat'), category: 'outerwear', warmth: 3, formality: 4, water: true, styles: ['classic', 'polished', 'minimal'], art: 'coat', search: 'trench coat' },
  { id: 'wool-coat', label: L('Wool coat'), category: 'outerwear', warmth: 4, formality: 4.5, styles: ['classic', 'polished', 'minimal'], art: 'coat', search: 'wool coat' },
  { id: 'puffer', label: L('Puffer jacket'), category: 'outerwear', warmth: 4.5, formality: 2, styles: ['casual', 'street', 'sporty'], art: 'puffer', search: 'puffer jacket' },
  { id: 'parka', label: L('Winter parka'), category: 'outerwear', warmth: 5, formality: 2, water: true, styles: ['casual', 'sporty'], art: 'puffer', search: 'insulated waterproof parka' },
  { id: 'fleece', label: L('Fleece'), category: 'outerwear', warmth: 3, formality: 1.5, styles: ['sporty', 'casual'], art: 'jacket', search: 'fleece jacket' },

  // ── Shoes ─────────────────────────────────────────────────────────────
  { id: 'sneakers', label: L('Sneakers'), category: 'shoes', warmth: 2, formality: 2, styles: ['casual', 'street', 'minimal', 'sporty'], art: 'sneaker', search: 'sneakers' },
  { id: 'runners', label: L('Running shoes'), category: 'shoes', warmth: 2, formality: 1, styles: ['sporty'], art: 'sneaker', search: 'running shoes' },
  { id: 'loafers', label: L('Loafers'), category: 'shoes', warmth: 2, formality: 3.5, styles: ['classic', 'polished'], art: 'loafer', search: 'loafers' },
  { id: 'dressshoes', label: L('Dress shoes'), category: 'shoes', warmth: 2, formality: 5, styles: ['polished', 'classic'], art: 'loafer', search: 'leather dress shoes' },
  { id: 'boots', label: L('Boots'), category: 'shoes', warmth: 4, formality: 3, styles: ['casual', 'classic', 'street'], art: 'boot', search: 'leather boots' },
  { id: 'waterproofboots', label: L('Waterproof boots'), category: 'shoes', warmth: 4, formality: 2.5, water: true, styles: ['casual', 'sporty'], art: 'boot', search: 'waterproof boots' },
  { id: 'chelsea', label: L('Chelsea boots'), category: 'shoes', warmth: 3, formality: 3.5, styles: ['classic', 'polished', 'minimal'], art: 'boot', search: 'chelsea boots' },
  { id: 'rainboots', label: L('Rain boots'), category: 'shoes', warmth: 3, formality: 1.5, water: true, styles: ['casual'], art: 'boot', search: 'rain boots' },
  { id: 'sandals', label: L('Sandals'), category: 'shoes', warmth: 1, formality: 1.5, open: true, styles: ['casual', 'boho'], art: 'sandal', search: 'sandals' },
  { id: 'flats', label: L('Flats'), category: 'shoes', warmth: 1.5, formality: 3.5, styles: ['classic', 'polished', 'minimal'], art: 'loafer', search: 'ballet flats' },
  { id: 'heels', label: L('Heels'), category: 'shoes', warmth: 1.5, formality: 4.5, open: true, styles: ['polished'], art: 'heel', search: 'heels' },

  // ── Accessories ───────────────────────────────────────────────────────
  { id: 'scarf', label: L('Scarf'), category: 'accessory', warmth: 3, formality: 3, accFn: 'cold', styles: ['classic', 'boho', 'minimal'], art: 'scarf', search: 'wool scarf' },
  { id: 'beanie', label: L('Beanie'), category: 'accessory', warmth: 3, formality: 1.5, accFn: 'cold', styles: ['casual', 'street'], art: 'beanie', search: 'beanie' },
  { id: 'gloves', label: L('Gloves'), category: 'accessory', warmth: 3, formality: 3, accFn: 'cold', styles: ['classic', 'casual'], art: 'gloves', search: 'gloves' },
  { id: 'sunglasses', label: L('Sunglasses'), category: 'accessory', warmth: 0, formality: 3, accFn: 'sun', styles: ['casual', 'classic', 'minimal'], art: 'sunglasses', search: 'sunglasses' },
  { id: 'cap', label: L('Cap'), category: 'accessory', warmth: 0.5, formality: 1.5, accFn: 'sun', styles: ['casual', 'sporty', 'street'], art: 'cap', search: 'baseball cap' },
  { id: 'sunhat', label: L('Sun hat'), category: 'accessory', warmth: 0.5, formality: 2, accFn: 'sun', styles: ['boho', 'casual'], art: 'sunhat', search: 'sun hat' },
  { id: 'umbrella', label: L('Umbrella'), category: 'accessory', warmth: 0, formality: 3, accFn: 'rain', styles: [], art: 'umbrella', search: 'compact umbrella' },
  { id: 'belt', label: L('Belt'), category: 'accessory', warmth: 0, formality: 3.5, accFn: 'style', styles: ['classic', 'polished'], art: 'belt', search: 'leather belt' },
  { id: 'bag', label: L('Bag'), category: 'accessory', warmth: 0, formality: 3, accFn: 'style', styles: ['minimal', 'classic', 'casual'], art: 'bag', search: 'tote bag' },
  { id: 'watch', label: L('Watch'), category: 'accessory', warmth: 0, formality: 3.5, accFn: 'style', styles: ['classic', 'polished', 'minimal'], art: 'watch', search: 'watch' }
];

export const TYPES = Object.freeze(Object.fromEntries(T.map((t) => [t.id, Object.freeze(t)])));
export const TYPE_IDS = Object.freeze(T.map((t) => t.id));

/** @param {string} category */
export function typesFor(category) {
  return T.filter((t) => t.category === category);
}

export const PATTERNS = Object.freeze(['solid', 'striped', 'checked', 'floral', 'graphic', 'animal', 'dotted', 'textured']);

export const OCCASIONS = Object.freeze({
  casual: { label: L('Casual'), formality: 2.2, tolerance: 1.0 },
  work: { label: L('Work'), formality: 3.8, tolerance: 0.8 },
  evening: { label: L('Dinner / evening'), formality: 3.6, tolerance: 0.9 },
  formal: { label: L('Formal event'), formality: 4.8, tolerance: 0.5 },
  active: { label: L('Active'), formality: 1, tolerance: 0.6 }
});

export const OCCASION_IDS = Object.freeze(Object.keys(OCCASIONS));

export const WARMTH_LABELS = Object.freeze(['', L('Very light'), L('Light'), L('Medium'), L('Warm'), L('Very warm')]);
export const FORMALITY_LABELS = Object.freeze(['', L('Athletic / lounge'), L('Casual'), L('Smart casual'), L('Business'), L('Formal')]);

/**
 * Fill every attribute a client may have omitted from the type defaults.
 * @param {object} g partial garment
 */
export function withDefaults(g) {
  const def = TYPES[g.type];
  if (!def) return g;
  return {
    ...g,
    category: def.category,
    warmth: g.warmth ?? def.warmth,
    formality: g.formality ?? def.formality,
    waterproof: g.waterproof ?? Boolean(def.water),
    styles: g.styles?.length ? g.styles : def.styles,
    // structural facts about the type, which the outfit engine needs and no client supplies
    layer: def.layer,
    open: Boolean(def.open),
    accFn: def.accFn
  };
}
