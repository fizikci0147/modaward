/**
 * Taste and fashion rules: the part of the engine that behaves like a stylist rather than a
 * thermostat. Everything here is cheap and pure, because it runs on thousands of combinations.
 *
 *  - occasionSpec     how dressed up an occasion is for THIS person (their dress code)
 *  - ownedAllowed     the "never suggest" list, applied to the pieces the person owns
 *  - stylePenalty     what makes an outfit look wrong however warm or colourful it is
 */
import { colorName } from '../shared/color.js';
import { OCCASIONS } from '../shared/taxonomy.js';

/** How the person's dress code shifts what "casual", "work" and the rest mean for them. */
const DRESS_CODE_SHIFT = {
  casual: { work: -0.7, evening: -0.3, casual: -0.1 },
  smart: {},
  business: { work: 0.5, evening: 0.2, casual: 0.3 },
  formal: { work: 0.8, evening: 0.4, casual: 0.5 }
};

/** @returns {{formality:number, tolerance:number, label:string}} */
export function occasionSpec(occasionId, prefs) {
  const base = OCCASIONS[occasionId] || OCCASIONS.casual;
  const shift = DRESS_CODE_SHIFT[prefs?.dressCode]?.[occasionId] ?? 0;
  return shift ? { ...base, formality: Math.max(1, Math.min(5, base.formality + shift)) } : base;
}

/** Descriptor words and types each "never" tag rules out (matches the shop's rules). */
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
  logos: { words: ['logo'] }
};

/** @returns {(garment: object) => boolean} true when the person has not ruled this piece out */
export function ownedAllowed(prefs) {
  const rules = (prefs?.never || []).map((n) => NEVER_RULES[n]).filter(Boolean);
  const patterns = new Set(prefs?.avoidedPatterns || []);
  if (!rules.length && !patterns.size) return () => true;
  return (g) => {
    if (g.pattern && patterns.has(g.pattern)) return false;
    const text = String(g.name || '').toLowerCase();
    for (const r of rules) {
      if (r.types?.includes(g.type)) return false;
      if (r.patterns?.includes(g.pattern)) return false;
      if (r.words?.some((w) => text.includes(w))) return false;
    }
    return true;
  };
}

const ATHLETIC = new Set(['hoodie', 'sportstop', 'joggers', 'leggings', 'cargo', 'runners']);
const DRESSY = new Set(['blazer', 'wool-coat', 'trench', 'dressshoes', 'heels', 'trousers', 'eveningdress', 'loafers', 'chelsea']);
const SUITING = new Set(['blazer', 'wool-coat', 'trench', 'dressshoes', 'heels', 'eveningdress']);

/** 'black' | 'brown' (brown, camel, tan, rust) | null: the two leather families that must not be mixed. */
export function leatherFamily(g) {
  if (!g?.color) return null;
  const name = g._colorName ?? colorName(g.color);
  if (name === 'black') return 'black';
  if (['brown', 'camel', 'rust'].includes(name)) return 'brown';
  return null;
}
const isBlack = (g) => leatherFamily(g) === 'black';
const isBrown = (g) => leatherFamily(g) === 'brown';

/** Bottoms a belt can be worn with. */
const BELTED = new Set(['jeans', 'chinos', 'trousers', 'cargo', 'skirt']);
/** A belt that matches the shoes (brown with brown, black with black) and belongs with these bottoms. */
export function beltSuits(belt, parts) {
  if (!parts.bottom || !BELTED.has(parts.bottom.type)) return false;
  const shoes = leatherFamily(parts.shoes);
  return Boolean(shoes) && shoes === leatherFamily(belt);
}

/**
 * How much a combination looks wrong to a stylist, 0 (fine) to ~0.6 (never show it unless nothing else works).
 * `parts` may be a bare core (top/bottom/dress only) while candidates are being ranked.
 */
export function stylePenalty(parts, ctx, occasionId, prefs) {
  const top = parts.upper?.[0];
  const { bottom, dress, shoes, outer } = parts;
  const worn = [top, bottom, dress, shoes, outer].filter(Boolean);
  const types = new Set(worn.map((g) => g.type));
  const streetwise = Math.max(prefs?.archetypes?.street ?? 0, prefs?.archetypes?.sporty ?? 0) >= 0.7;
  let p = 0;

  // sportswear and tailoring do not share an outfit (a hoodie under a blazer, joggers with loafers)...
  const athletic = worn.some((g) => ATHLETIC.has(g.type));
  if (athletic && worn.some((g) => DRESSY.has(g.type))) p += streetwise ? 0.12 : 0.3;
  // ...and neither do shorts and a coat or smart shoes
  if (types.has('shorts') && worn.some((g) => SUITING.has(g.type))) p += 0.3;
  // a skirt under a hoodie only works as streetwear
  if (types.has('skirt') && types.has('hoodie')) p += streetwise ? 0.03 : 0.15;

  // shorts belong to warm, relaxed days: not cool ones, not under a jacket, not at work
  if (types.has('shorts')) {
    if (ctx.avgFeels < 20 || ctx.minFeels < 13) p += 0.45;
    if (outer) p += 0.3;
    if (occasionId === 'work' || occasionId === 'formal') p += 0.4;
    else if (occasionId === 'evening') p += 0.25;
  }
  // a sundress is a summer dress, coat or not
  if (types.has('sundress') && ctx.avgFeels < 17) p += 0.45;
  // open shoes on a cool day
  if (shoes?.open && ctx.avgFeels < 16) p += 0.35;

  // wellies on a dry day look like a mistake
  if (shoes?.type === 'rainboots' && ctx.rain === 'none' && !ctx.snow) p += 0.3;
  // bare legs below freezing
  if ((types.has('skirt') || dress) && ctx.minFeels < 3 && !types.has('knitdress')) p += 0.12;
  // denim jacket over jeans: possible, but a stylist reaches for contrast first
  if (types.has('denimjacket') && types.has('jeans')) p += 0.08;

  // a cardigan is a layer: on its own it reads as unfinished (kept possible for people who own little else)
  if (top?.layer === 'mid') p += 0.1;

  // black next to brown is the classic colour slip
  if ((isBlack(bottom) && isBrown(shoes)) || (isBrown(bottom) && isBlack(shoes))) p += 0.06;
  if ((isBlack(top) && isBrown(bottom)) || (isBrown(top) && isBlack(bottom))) p += 0.05;

  return Math.min(0.6, p);
}
