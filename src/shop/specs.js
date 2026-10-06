/**
 * Style-aware piece library.
 *
 * When no retailer feed covers a piece, the shopping engine still reasons about it as a "spec":
 * a garment type in a colour, with a descriptor a person (or a retailer search box) understands,
 * e.g. "heavyweight crewneck t-shirt in cream". Specs let the engine create hundreds of
 * distinct, harmonious looks without inventing products, prices or links.
 */
import { TYPES } from '../shared/taxonomy.js';
import { PALETTE, swatch } from '../shared/color.js';

/** Colours that read well for each style archetype. */
export const ARCHETYPE_PALETTES = Object.freeze({
  minimal: ['white', 'black', 'grey', 'cream', 'navy', 'charcoal', 'camel', 'beige'],
  classic: ['navy', 'white', 'camel', 'grey', 'burgundy', 'forest green', 'light denim', 'khaki'],
  casual: ['grey', 'denim', 'white', 'olive', 'navy', 'rust', 'mustard', 'light grey'],
  sporty: ['black', 'grey', 'white', 'navy', 'royal blue', 'red', 'charcoal'],
  street: ['black', 'white', 'grey', 'olive', 'rust', 'charcoal', 'khaki'],
  polished: ['black', 'navy', 'white', 'charcoal', 'camel', 'burgundy', 'blush', 'cream'],
  boho: ['cream', 'rust', 'sage', 'mustard', 'brown', 'blush', 'olive', 'beige']
});

/** Which colours make sense for each garment category (footwear and denim have narrower ranges). */
const CATEGORY_COLORS = {
  top: null, // any palette colour
  bottom: ['black', 'navy', 'khaki', 'grey', 'charcoal', 'olive', 'cream', 'beige', 'denim', 'light denim', 'brown', 'camel', 'burgundy', 'forest green', 'rust', 'blush', 'sage'],
  dress: null,
  outerwear: ['black', 'navy', 'camel', 'olive', 'grey', 'charcoal', 'beige', 'khaki', 'brown', 'denim', 'forest green', 'burgundy', 'rust', 'cream'],
  shoes: ['white', 'black', 'brown', 'camel', 'beige', 'grey', 'navy', 'burgundy', 'cream', 'blush'],
  accessory: ['black', 'grey', 'navy', 'camel', 'brown', 'cream', 'burgundy', 'charcoal', 'olive', 'rust']
};

/** Types where only specific colours are realistic. */
const TYPE_COLORS = {
  jeans: ['denim', 'light denim', 'black', 'grey', 'navy'],
  denimjacket: ['denim', 'light denim', 'black'],
  chinos: ['khaki', 'navy', 'olive', 'beige', 'cream', 'grey', 'black'],
  trousers: ['black', 'charcoal', 'navy', 'grey', 'camel', 'cream', 'burgundy'],
  blazer: ['navy', 'black', 'charcoal', 'camel', 'grey', 'cream', 'burgundy'],
  dressshoes: ['black', 'brown', 'burgundy'],
  loafers: ['brown', 'black', 'burgundy', 'camel', 'navy'],
  sneakers: ['white', 'black', 'grey', 'cream', 'navy', 'beige'],
  runners: ['black', 'grey', 'white', 'navy', 'royal blue'],
  boots: ['brown', 'black', 'camel', 'beige'],
  chelsea: ['brown', 'black', 'camel', 'burgundy'],
  waterproofboots: ['brown', 'black', 'olive', 'navy'],
  rainboots: ['black', 'navy', 'olive', 'forest green', 'yellow'],
  sandals: ['brown', 'camel', 'black', 'beige', 'white'],
  heels: ['black', 'camel', 'blush', 'burgundy', 'white'],
  flats: ['black', 'camel', 'blush', 'navy', 'cream'],
  raincoat: ['navy', 'black', 'olive', 'yellow', 'forest green', 'grey'],
  trench: ['camel', 'beige', 'navy', 'black', 'khaki'],
  'wool-coat': ['camel', 'charcoal', 'navy', 'black', 'grey', 'cream', 'burgundy'],
  parka: ['black', 'navy', 'olive', 'charcoal', 'forest green'],
  puffer: ['black', 'navy', 'olive', 'charcoal', 'cream', 'rust'],
  sunglasses: ['black', 'brown'],
  umbrella: ['black', 'navy']
};

/** Descriptors that sharpen a search: `[style]: phrase` (falls back to the taxonomy's generic phrase). */
const DESCRIPTORS = {
  tee: { minimal: 'heavyweight crewneck t-shirt', classic: 'pima cotton crewneck t-shirt', casual: 'cotton crew neck t-shirt', street: 'oversized boxy t-shirt', boho: 'relaxed linen blend t-shirt' },
  longsleeve: { minimal: 'merino long sleeve tee', casual: 'waffle knit long sleeve tee', street: 'oversized long sleeve tee' },
  polo: { classic: 'pique polo shirt', casual: 'knit polo shirt' },
  shirt: { classic: 'oxford button down shirt', minimal: 'poplin button up shirt', polished: 'tailored poplin shirt', casual: 'linen button up shirt', boho: 'relaxed linen shirt' },
  blouse: { polished: 'silk blouse', classic: 'button front blouse', boho: 'flowy peasant blouse', minimal: 'crisp cotton blouse' },
  sweater: { classic: 'merino crewneck sweater', minimal: 'fine gauge crewneck sweater', casual: 'chunky knit sweater', boho: 'cozy cable knit sweater' },
  cardigan: { classic: 'merino cardigan', boho: 'oversized knit cardigan', minimal: 'fine knit cardigan' },
  hoodie: { casual: 'fleece pullover hoodie', street: 'oversized hoodie', sporty: 'tech fleece hoodie' },
  sportstop: { sporty: 'moisture wicking training t-shirt' },
  jeans: { classic: 'straight leg jeans', casual: 'relaxed straight jeans', street: 'wide leg jeans', minimal: 'tapered jeans', boho: 'flare jeans' },
  chinos: { classic: 'slim chino pants', casual: 'straight chino pants', minimal: 'tapered chino pants' },
  trousers: { polished: 'tailored wool trousers', classic: 'pleated trousers', minimal: 'straight leg trousers', boho: 'wide leg linen trousers' },
  joggers: { sporty: 'tapered training joggers', street: 'cuffed sweatpants', casual: 'fleece joggers' },
  cargo: { street: 'relaxed cargo pants', casual: 'utility cargo pants' },
  skirt: { classic: 'pleated midi skirt', boho: 'tiered maxi skirt', polished: 'pencil skirt', minimal: 'satin slip skirt' },
  dress: { polished: 'sheath dress', classic: 'wrap dress', boho: 'floral midi dress' },
  sundress: { boho: 'smocked sundress', casual: 'cotton sundress' },
  blazer: { polished: 'tailored blazer', classic: 'single breasted blazer', minimal: 'unstructured blazer' },
  raincoat: { casual: 'waterproof rain jacket', sporty: 'packable rain jacket', minimal: 'lightweight waterproof jacket' },
  trench: { classic: 'classic trench coat', minimal: 'water resistant trench coat', polished: 'belted trench coat' },
  'wool-coat': { classic: 'wool blend coat', polished: 'tailored wool overcoat', minimal: 'minimalist wool coat' },
  puffer: { casual: 'packable puffer jacket', street: 'oversized puffer jacket', sporty: 'lightweight down jacket' },
  sneakers: { minimal: 'leather court sneakers', casual: 'canvas sneakers', street: 'chunky sneakers', classic: 'low top leather sneakers' },
  loafers: { classic: 'penny loafers', polished: 'leather loafers' },
  boots: { casual: 'lace up boots', classic: 'leather boots', street: 'combat boots' },
  sandals: { casual: 'leather slide sandals', boho: 'woven leather sandals' }
};

const SPECS_CACHE = new Map();

/** Descriptor phrase for a type in a style. */
export function descriptorFor(typeId, style) {
  return DESCRIPTORS[typeId]?.[style] ?? DESCRIPTORS[typeId]?.[Object.keys(DESCRIPTORS[typeId] ?? {})[0]] ?? TYPES[typeId].search;
}

/** Colours allowed for a type, intersected with a style palette. */
function colorsFor(typeId, style, extra = []) {
  const type = TYPES[typeId];
  const base = [...(ARCHETYPE_PALETTES[style] ?? ARCHETYPE_PALETTES.classic)];
  const allowed = TYPE_COLORS[typeId] ?? CATEGORY_COLORS[type.category];
  // colours the person loves join the palette wherever they are realistic for the garment
  for (const c of extra) if (!base.includes(c) && (!allowed || allowed.includes(c))) base.push(c);
  const picked = allowed ? base.filter((c) => allowed.includes(c)) : base;
  // a type with no overlap with the palette still gets its own most natural colours
  return picked.length >= 2 ? picked : (allowed ?? base).slice(0, 4);
}

/**
 * Every spec piece for a type, across styles. Cached because the library is static.
 * @returns {{id:string, type:string, category:string, color:string, colorName:string, descriptor:string, style:string, pattern:string}[]}
 */
export function specsForType(typeId, extraColors = []) {
  const cacheKey = extraColors.length ? `${typeId}|${[...extraColors].sort().join(',')}` : typeId;
  if (SPECS_CACHE.has(cacheKey)) return SPECS_CACHE.get(cacheKey);
  const type = TYPES[typeId];
  const out = [];
  const seen = new Set();
  const styles = type.styles.length ? type.styles : ['classic'];
  for (const style of styles) {
    const descriptor = descriptorFor(typeId, style);
    for (const name of colorsFor(typeId, style, extraColors)) {
      const sw = swatch(name);
      if (!sw) continue;
      const id = `spec:${typeId}:${name}:${descriptor}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, type: typeId, category: type.category, color: sw.hex, colorName: name, descriptor, style, pattern: 'solid' });
    }
  }
  SPECS_CACHE.set(cacheKey, out);
  if (SPECS_CACHE.size > 400) SPECS_CACHE.delete(SPECS_CACHE.keys().next().value);
  return out;
}

export const ALL_PALETTE_NAMES = PALETTE.map((p) => p.name);
