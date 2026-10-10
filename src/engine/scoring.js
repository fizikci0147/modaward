/**
 * Component scorers for an outfit. Each returns a number in 0–1 (higher is better).
 * They are pure and cheap because the engine evaluates thousands of combinations per request.
 */
import { L } from '../shared/i18n.js';
import { DORMANT_DAYS } from '../shared/dormancy.js';
import { stylePenalty, occasionSpec, patternAdjust } from './stylist.js';
import { harmony, colorName } from '../shared/color.js';
import { thermalScore } from './thermal.js';

export const WEIGHTS = Object.freeze({
  thermal: 0.26,
  protection: 0.12,
  occasion: 0.2,
  harmony: 0.14,
  style: 0.22, // the person's taste matters as much as the weather
  fresh: 0.06
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The pieces visible for formality and colour purposes. */
export function mainPieces(parts) {
  const list = [...parts.upper];
  if (parts.bottom) list.push(parts.bottom);
  if (parts.dress) list.push(parts.dress);
  if (parts.shoes) list.push(parts.shoes);
  return list;
}

export function allPieces(parts) {
  const list = mainPieces(parts);
  if (parts.outer) list.push(parts.outer);
  return list.concat(parts.accessories);
}

/**
 * Normalise a stored profile into the shape the scorers want.
 * @param {{style?: {archetypes?: Record<string, number>, likedColors?: string[], avoidedColors?: string[]}}|null} profile
 */
export function normalizePrefs(profile) {
  const style = profile?.style || {};
  return {
    archetypes: style.archetypes || {},
    liked: new Set(style.likedColors || []),
    avoided: new Set(style.avoidedColors || []),
    hasProfile: Boolean(Object.keys(style.archetypes || {}).length),
    dressCode: profile?.lifestyle?.dressCode || 'smart',
    never: style.never || [],
    avoidedPatterns: style.avoidedPatterns || []
  };
}

/** How much one garment suits the person: 0–1, 0.5 is neutral. */
export function garmentAffinity(g, prefs) {
  let aff = 0.5;
  if (g.styles?.length && prefs.hasProfile) {
    let sum = 0;
    for (const tag of g.styles) sum += prefs.archetypes[tag] ?? 0.5;
    aff = sum / g.styles.length;
  }
  if (g.color) {
    const name = g._colorName ?? colorName(g.color);
    if (prefs.avoided.has(name)) aff -= 0.4;
    else if (prefs.liked.has(name)) aff += 0.14;
  }
  if (g.pattern && g.pattern !== 'solid' && prefs.hasProfile) aff += patternAdjust(g, prefs);
  if (g.favorite) aff += 0.08;
  return clamp01(aff);
}

export function styleScore(parts, prefs) {
  let sum = 0;
  let weight = 0;
  for (const g of mainPieces(parts)) {
    const w = g.category === 'shoes' ? 0.7 : 1;
    sum += garmentAffinity(g, prefs) * w;
    weight += w;
  }
  if (parts.outer) {
    sum += garmentAffinity(parts.outer, prefs) * 0.8;
    weight += 0.8;
  }
  const declared = weight ? sum / weight : 0.5;
  if (!prefs.taste) return declared;
  // learned taste: what the person actually reacts to, blended with what they said in the quiz
  const items = parts.outer ? [...mainPieces(parts), parts.outer] : mainPieces(parts);
  const learned = prefs.taste.score(items);
  const w = prefs.tasteWeight ?? 0.5;
  return (1 - w) * declared + w * learned;
}

export function harmonyScore(parts) {
  const colored = [];
  for (const g of mainPieces(parts)) colored.push({ hex: g.color, weight: g.category === 'shoes' ? 0.6 : 1 });
  if (parts.outer) colored.push({ hex: parts.outer.color, weight: 0.9 });
  const result = harmony(colored);

  const loud = [...parts.upper, parts.bottom, parts.dress, parts.outer].filter(
    (g) => g && g.pattern && g.pattern !== 'solid' && g.pattern !== 'textured'
  );
  let score = result.score;
  let note = result.note;
  if (loud.length >= 3) {
    score -= 0.5;
    note = L('Too many patterns at once');
  } else if (loud.length === 2) {
    score -= 0.28;
    note = L('Two patterns compete');
  }
  return { score: clamp01(score), note };
}

/** Formality relative to the occasion, plus coherence between pieces. */
export function occasionScore(parts, occasionId, outerMode, prefs) {
  const occ = occasionSpec(occasionId, prefs);
  const visible = mainPieces(parts).filter((g) => g.category !== 'accessory');
  if (parts.outer && outerMode !== 'never') visible.push(parts.outer);
  if (!visible.length) return { score: 0.5, mean: 0, spread: 0 };

  const values = visible.map((g) => g.formality);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const spread = Math.max(...values) - Math.min(...values);

  const sigma = Math.max(0.5, occ.tolerance * 1.25);
  const fit = Math.exp(-(((mean - occ.formality) / sigma) ** 2));
  const coherence = 1 - clamp01((spread - 1) / 2.5);

  let score = 0.65 * fit + 0.35 * coherence;
  if (occasionId === 'active') {
    const sporty = visible.filter((g) => g.styles?.includes('sporty')).length / visible.length;
    score = 0.4 * fit + 0.6 * sporty;
  }
  return { score: clamp01(score), mean, spread };
}

/** Rain / snow protection. */
export function protectionScore(parts, ctx) {
  if (ctx.rain === 'none' && !ctx.snow) return 1;
  const outerWet = parts.outer?.waterproof ? 1 : 0;
  const umbrella = parts.accessories.some((a) => a.type === 'umbrella') ? 1 : 0;
  const shoes = parts.shoes;
  let shoeFactor = 0.55; // closed but not waterproof
  if (!shoes) shoeFactor = 0.3;
  else if (shoes.waterproof) shoeFactor = 1;
  else if (shoes.open) shoeFactor = 0;

  let score;
  if (ctx.snow) {
    const grip = shoes ? (shoes.waterproof ? 1 : shoes.warmth >= 3.5 ? 0.7 : shoes.open ? 0 : 0.25) : 0.2;
    score = 0.15 + 0.35 * outerWet + 0.4 * grip + 0.1 * (parts.outer ? 0.6 : 0);
  } else if (ctx.rain === 'heavy') {
    score = 0.05 + 0.4 * Math.max(outerWet, umbrella * 0.7) + 0.3 * shoeFactor + 0.1 * umbrella + 0.15 * (parts.outer ? 0.4 : 0);
  } else {
    score = 0.3 + 0.28 * Math.max(outerWet, umbrella * 0.8) + 0.2 * shoeFactor + 0.12 * (parts.outer ? 0.5 : 0) + 0.1 * umbrella;
  }
  return clamp01(score);
}

/**
 * Freshness: avoid what was worn in the last days, and exact repeats.
 * @param {Map<string, number>} lastWornDaysAgo garment id → days since last worn
 * @param {Map<string, number>} avoid           extra per-garment penalties 0–1 (planner uses this)
 * @param {Set<string>} recentOutfitKeys        keys of whole outfits worn in the last two weeks
 */
export function freshnessScore(parts, key, lastWornDaysAgo, avoid, recentOutfitKeys) {
  const pieces = mainPieces(parts);
  if (parts.outer) pieces.push(parts.outer);
  let penalty = 0;
  for (const g of pieces) {
    const days = lastWornDaysAgo.get(g.id);
    let p = 0;
    if (days != null) p = days <= 0 ? 1 : days === 1 ? 0.75 : days === 2 ? 0.45 : days <= 4 ? 0.25 : days <= 7 ? 0.1 : 0;
    // shoes and outerwear are re-worn constantly; forgive them
    if (g.category === 'shoes' || g.category === 'outerwear') p *= 0.4;
    p = Math.max(p, (avoid.get(g.id) ?? 0) * (g.category === 'shoes' || g.category === 'outerwear' ? 0.5 : 1));
    penalty += p;
  }
  let score = 1 - penalty / Math.max(1, pieces.length);
  if (recentOutfitKeys.has(key)) score -= 0.5;
  // gently surface pieces that have not seen daylight
  const unloved = pieces.filter((g) => (g.wearCount ?? 0) === 0 && !lastWornDaysAgo.has(g.id)).length;
  // and bring back what has sat unworn for a long time (idleDays is set by the outfit service)
  const forgotten = pieces.filter((g) => (g.wearCount ?? 0) > 0 && (g.idleDays ?? 0) >= DORMANT_DAYS && !lastWornDaysAgo.has(g.id)).length;
  score += Math.min(0.08, unloved * 0.03 + forgotten * 0.03);
  return clamp01(score);
}

/**
 * Score a complete set of parts.
 * @param {import('./thermal.js').Parts} parts
 * @param {object} env  { ctx, occasion, prefs, lastWorn, avoid, recentKeys, key }
 */
export function scoreParts(parts, env) {
  const thermal = thermalScore(parts, env.ctx);
  const protection = protectionScore(parts, env.ctx);
  const occasion = occasionScore(parts, env.occasion, thermal.outer, env.prefs);
  const color = harmonyScore(parts);
  const style = styleScore(parts, env.prefs);
  const fresh = freshnessScore(parts, env.key, env.lastWorn, env.avoid, env.recentKeys);

  let total =
    WEIGHTS.thermal * thermal.score +
    WEIGHTS.protection * protection +
    WEIGHTS.occasion * occasion.score +
    WEIGHTS.harmony * color.score +
    WEIGHTS.style * style +
    WEIGHTS.fresh * fresh;

  // proportional penalties: being under-dressed is worse than over-dressed
  total -= 0.5 * thermal.deficit + 0.25 * thermal.excess;

  // what a stylist would never put together
  total -= stylePenalty(parts, env.ctx, env.occasion, env.prefs);

  // a rain shell on a dry day is utility wear; prefer a regular jacket of similar warmth
  if (parts.outer?.waterproof && env.ctx.rain === 'none' && !env.ctx.snow && thermal.outer !== 'never') total -= 0.035;

  // hard caps: an outfit that fails the weather should never top the list
  if (protection < 0.35 && (env.ctx.rain === 'heavy' || env.ctx.snow)) total = Math.min(total, 0.35 + 0.5 * protection);
  if (thermal.worst < 0.12) total = Math.min(total, 0.55);

  return {
    total,
    thermal,
    protection,
    occasion,
    color,
    style,
    fresh
  };
}
