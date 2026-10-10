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
import { trendsFor, seasonOf, trendFreshness } from '../shared/trends.js';

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

/**
 * Two tops in one outfit only when it is a real, wearable layered look: a base with the layer
 * that belongs over it. Anything else (a polo and a button-up, a tee under a crew sweater, two
 * layers over one another) reads as indecision.
 */
const LAYER_PAIRS = {
  tee: ['cardigan', 'hoodie'],
  longsleeve: ['cardigan', 'hoodie'],
  polo: ['sweater', 'cardigan'],
  shirt: ['sweater', 'cardigan'],
  blouse: ['cardigan', 'sweater'],
  sportstop: ['hoodie']
};

/** @returns {boolean} true when `mid` is a layer that is worn over `base` */
export function layerOk(base, mid) {
  return Boolean(LAYER_PAIRS[base.type]?.includes(mid.type)) && base.id !== mid.id;
}

/** Layering is for days that call for it: on a warm day two tops is just heat. */
export const layeringWeather = (ctx) => ctx.avgFeels < 15 || ctx.minFeels < 9;

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

/** How much the person's taste for loud or quiet prints shifts a piece: minimalists skip them, boho loves florals, streetwear loves graphics. */
export function patternAdjust(g, prefs) {
  const a = prefs?.archetypes || {};
  switch (g.pattern) {
    case 'floral':
      return 0.1 * (a.boho ?? 0) - 0.16 * (a.minimal ?? 0) - 0.06 * (a.polished ?? 0);
    case 'graphic':
      return 0.12 * (a.street ?? 0) - 0.2 * Math.max(a.classic ?? 0, a.minimal ?? 0, a.polished ?? 0);
    case 'animal':
      return -0.18 * Math.max(a.minimal ?? 0, a.classic ?? 0);
    case 'checked':
      return 0.05 * (a.classic ?? 0) - 0.08 * (a.minimal ?? 0);
    default:
      return 0;
  }
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
  const upper = parts.upper || [];
  const top = upper[0];
  const { bottom, dress, shoes, outer } = parts;
  const worn = [...upper, bottom, dress, shoes, outer].filter(Boolean);
  const types = new Set(worn.map((g) => g.type));
  const streetwise = Math.max(prefs?.archetypes?.street ?? 0, prefs?.archetypes?.sporty ?? 0) >= 0.7;
  let p = 0;

  // sportswear and tailoring do not share an outfit (a hoodie under a blazer, joggers with loafers)...
  const athletic = worn.some((g) => ATHLETIC.has(g.type));
  if (athletic && worn.some((g) => DRESSY.has(g.type))) p += streetwise ? 0.12 : 0.3;
  // a silk blouse does not go with cargo pants, joggers or leggings
  if (types.has('blouse') && worn.some((g) => g.category === 'bottom' && ['cargo', 'joggers', 'leggings'].includes(g.type))) p += 0.22;
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
  // running shoes belong to sport, and to relaxed casual days with relaxed bottoms
  if (shoes?.type === 'runners') {
    if (occasionId !== 'casual' && occasionId !== 'active') p += 0.4;
    else if (!(prefs?.archetypes?.sporty >= 0.6) && occasionId === 'casual' && bottom && !['joggers', 'leggings', 'shorts', 'cargo'].includes(bottom.type)) p += 0.15;
  }
  // relaxed bottoms (joggers, cargo, leggings) are not for work, formal events or, unless you love streetwear, evenings out
  if (bottom && ['joggers', 'cargo', 'leggings'].includes(bottom.type)) {
    if (occasionId === 'work' || occasionId === 'formal') p += 0.3;
    else if (occasionId === 'evening' && !streetwise) p += 0.2;
  }
  // loud prints against a quiet taste
  const wearsLoud = (types_) => worn.filter((g) => g.pattern && types_.includes(g.pattern)).length;
  const calm = Math.max(prefs?.archetypes?.minimal ?? 0, prefs?.archetypes?.classic ?? 0, prefs?.archetypes?.polished ?? 0);
  if (calm >= 0.7) p += 0.12 * wearsLoud(['graphic', 'animal']) + (prefs?.archetypes?.minimal >= 0.7 ? 0.1 * wearsLoud(['floral']) : 0);
  // a sundress is a summer dress, coat or not
  if (types.has('sundress') && ctx.avgFeels < 17) p += 0.45;
  // open shoes on a cool day
  if (shoes?.open && ctx.avgFeels < 16) p += 0.35;

  // wellies on a dry day look like a mistake
  if (shoes?.type === 'rainboots' && ctx.rain === 'none' && !ctx.snow) p += 0.3;
  // bare legs below freezing
  if ((types.has('skirt') || dress) && ctx.minFeels < 3 && !types.has('knitdress')) p += 0.12;
  // denim jacket over jeans: possible, but a stylist reaches for contrast first
  const denimLike = (g) => g && (['jeans'].includes(g.type) || ['denim', 'light denim'].includes(g._colorName ?? colorName(g.color)));
  if (types.has('denimjacket') && (denimLike(bottom) || (upper.length && upper.some((u) => ['denim', 'light denim'].includes(u._colorName ?? colorName(u.color)))))) p += 0.12;
  // a checked or flannel shirt with a skirt or dress is a look for boho and streetwear tastes only
  const checkedTop = upper.some((u) => u.pattern === 'checked');
  if (checkedTop && (types.has('skirt') || dress) && !((prefs?.archetypes?.boho ?? 0) >= 0.6 || streetwise)) p += 0.14;

  // a cardigan is a layer: on its own it reads as unfinished (kept possible for people who own little else)
  if (upper.length === 1 && top?.layer === 'mid') p += 0.12;
  // a layered look needs contrast and one pattern at most
  if (upper.length === 2) {
    const [base, mid] = upper;
    if ((base._colorName ?? colorName(base.color)) === (mid._colorName ?? colorName(mid.color))) p += 0.12;
    const loud = (g) => g.pattern && g.pattern !== 'solid' && g.pattern !== 'textured';
    if (loud(base) && loud(mid)) p += 0.25;
    if (!layeringWeather(ctx)) p += 0.4;
    // shirt, sweater and a blazer is one layer too many
    if (outer?.type === 'blazer') p += 0.1;
  }

  // black next to brown is the classic colour slip
  if ((isBlack(bottom) && isBrown(shoes)) || (isBrown(bottom) && isBlack(shoes))) p += 0.06;
  if ((isBlack(top) && isBrown(bottom)) || (isBrown(top) && isBlack(bottom))) p += 0.05;

  p += selectionPenalty(parts, prefs);
  return Math.min(0.6, p);
}

/**
 * What the person told us outright. A colour they avoid is nearly a veto, a colour they love is a
 * lift (up to two pieces), and the areas they asked to cover are respected.
 * Returns a penalty; a lift is a negative number.
 */
export function selectionPenalty(parts, prefs) {
  if (!prefs) return 0;
  const pieces = [...(parts.upper || []), parts.bottom, parts.dress, parts.shoes, parts.outer].filter(Boolean);
  let p = 0;
  let liked = 0;
  for (const g of pieces) {
    const name = g._colorName ?? colorName(g.color);
    if (prefs.avoided?.has(name)) p += g.category === 'shoes' || g.category === 'outerwear' ? 0.12 : 0.2;
    else if (prefs.liked?.has(name)) liked += 1;
  }
  p -= Math.min(2, liked) * 0.025;
  const types = new Set(pieces.map((g) => g.type));
  const covers = new Set(prefs.cover || []);
  if (covers.has('legs') && types.has('shorts')) p += 0.2;
  if (covers.has('arms') && types.has('sportstop')) p += 0.1;
  return p;
}

// ── trends ──────────────────────────────────────────────────────────────

const BLACKS = new Set(['black', 'charcoal']);
const WARMS = new Set(['camel', 'brown', 'beige', 'cream', 'khaki', 'olive']);
const nameOf = (g) => g._colorName ?? colorName(g.color);

/** Does `match` (a clause from shared/trends.js) describe this outfit? */
export function matches(parts, match) {
  const upper = parts.upper || [];
  const main = [...upper, parts.bottom, parts.dress].filter(Boolean);
  const all = [...main, parts.shoes, parts.outer].filter(Boolean);
  const scope = (on) => (on === 'upper' ? upper : on === 'any' ? all : on === 'main' ? [...main, parts.shoes].filter(Boolean) : [...main, parts.outer].filter(Boolean));
  if (match.all) return match.all.every((m) => matches(parts, m));
  if (match.colors) return scope(match.on).some((g) => match.colors.includes(nameOf(g)));
  if (match.types) return scope(match.on === undefined ? 'any' : match.on).some((g) => match.types.includes(g.type));
  if (match.patterns) return [...upper, parts.bottom, parts.dress].filter(Boolean).some((g) => match.patterns.includes(g.pattern));
  if (match.tonal) {
    if (main.length < 2) return false;
    const family = match.tonal === 'black' ? BLACKS : WARMS;
    return main.every((g) => family.has(nameOf(g))) && (match.tonal !== 'warm' || new Set(main.map(nameOf)).size >= 1);
  }
  return false;
}

const MULT = { off: 0, light: 1, forward: 2 };

/**
 * What is in style this season, filtered through the person's taste. `outfitLiking` is how much the
 * person likes this outfit overall (0–1): a trend adds nothing to an outfit they would not enjoy.
 * @returns {{bonus:number, matched:{id:string,label:string}[]}}
 */
export function trendBonus(parts, ctx, prefs, outfitLiking) {
  const mult = (MULT[prefs?.trendiness ?? 'light'] ?? 1) * trendFreshness(ctx.date ? new Date(`${ctx.date}T12:00:00Z`) : new Date());
  if (!mult) return { bonus: 0, matched: [] };
  const liking = Math.max(0, Math.min(1, (outfitLiking - 0.45) / 0.3));
  if (liking <= 0) return { bonus: 0, matched: [] };
  const archetypes = prefs?.archetypes || {};
  const known = prefs?.hasProfile;
  const season = seasonOf(ctx.date, prefs?.hemisphere);
  let bonus = 0;
  const matched = [];
  for (const trend of trendsFor(season)) {
    if (!matches(parts, trend.match)) continue;
    const relevance = !known || !trend.archetypes ? 0.6 : Math.max(0, ...trend.archetypes.map((a) => archetypes[a] ?? 0));
    if (relevance < 0.3) continue; // not this person's style: a trend is not a reason to wear it
    const b = trend.weight * relevance * liking * mult;
    if (b <= 0) continue;
    bonus += b;
    matched.push({ id: trend.id, label: trend.label, labels: trend.labels, weight: b });
  }
  matched.sort((a, b) => b.weight - a.weight);
  return { bonus: Math.min(0.06 * mult, bonus), matched: matched.map(({ id, label, labels }) => ({ id, label, labels })) };
}
