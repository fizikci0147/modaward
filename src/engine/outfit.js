/**
 * Outfit generation.
 *
 * Search strategy (keeps a request to a few thousand evaluations even for 300-item closets):
 *   1. Build "cores": an upper-body set (one top, or base + mid layer) with a bottom, or a dress.
 *   2. Rank cores against the weather, occasion, colour and style, assuming the best outer layer.
 *   3. Take the best cores and add every sensible shoe × outer-layer combination, scoring fully.
 *   4. Choose a diverse top-N, then add weather-driven accessories to each.
 */
import { OCCASIONS, withDefaults } from '../shared/taxonomy.js';
import { L } from '../shared/i18n.js';
import { colorName } from '../shared/color.js';
import { DORMANT_DAYS, agoText } from '../shared/dormancy.js';
import { cToF } from '../shared/weather-codes.js';
import { buildContext, dayTips, fmtHour } from './context.js';
import { requiredInsulation } from './thermal.js';
import { thermalScore } from './thermal.js';
import {
  scoreParts,
  normalizePrefs,
  garmentAffinity,
  occasionScore,
  harmonyScore,
  styleScore,
  freshnessScore,
  mainPieces,
  WEIGHTS
} from './scoring.js';
import { rng, hashString } from './rng.js';

const MAX_CORES = 36;
const MAX_SHOES = 8;
const MAX_OUTERS = 7;
const MAX_BASES = 8;
const MAX_MIDS = 8;

/** Normalise raw garments from storage or the shop catalogue. */
export function prepareGarments(list) {
  const out = [];
  for (const raw of list) {
    if (raw.archived) continue;
    const g = withDefaults(raw);
    if (!g.category || !g.color) continue;
    out.push({ ...g, colorName: g.colorName ?? colorName(g.color), _colorName: colorName(g.color) });
  }
  return out;
}

const byCategory = (garments, category) => garments.filter((g) => g.category === category);

export function outfitKey(parts) {
  const ids = mainPieces(parts).map((g) => g.id);
  if (parts.outer) ids.push(parts.outer.id);
  return ids.sort().join('|');
}

const emptyParts = () => ({ upper: [], bottom: null, dress: null, outer: null, shoes: null, accessories: [] });

/** Everything that can be worn as the upper body, singly or layered. */
function upperSets(tops, ctx, shortlist = (items) => items) {
  const sets = [];
  for (const t of tops) if (t.layer !== 'mid') sets.push([t]);
  const allowLayering = ctx.minFeels < 17 || ctx.avgFeels < 20;
  if (allowLayering) {
    // every base × every mid layer would multiply the whole search, so only the most promising few of each are paired
    const bases = shortlist(tops.filter((t) => t.layer === 'base' || (t.layer === 'either' && t.warmth <= 2.2)), MAX_BASES);
    const mids = shortlist(tops.filter((t) => (t.layer === 'mid' || t.layer === 'either') && t.warmth >= 2), MAX_MIDS);
    for (const b of bases) {
      for (const m of mids) {
        if (m.id === b.id || m.warmth < b.warmth) continue;
        sets.push([b, m]);
      }
    }
  }
  return sets;
}

/** Cheap per-garment relevance used to pick which shoes/outers get a full evaluation. */
function quickRank(items, env, limit, mustKeep) {
  const occ = OCCASIONS[env.occasion] || OCCASIONS.casual;
  const scored = items.map((g) => {
    const f = Math.exp(-(((g.formality - occ.formality) / 1.4) ** 2));
    const s = garmentAffinity(g, env.prefs);
    return { g, v: 0.55 * f + 0.45 * s + (mustKeep?.(g) ? 1 : 0) };
  });
  scored.sort((a, b) => b.v - a.v);
  return scored.slice(0, limit).map((x) => x.g);
}

/**
 * Shortlist a large set while keeping variety: best-ranked first, but no single garment type
 * may fill more than its share, so a pool of 100 white tees cannot crowd out every other top.
 */
function diverseShortlist(items, limit, env, mustKeep) {
  const occ = OCCASIONS[env.occasion] || OCCASIONS.casual;
  const ranked = items
    .map((g) => ({ g, v: 0.5 * Math.exp(-(((g.formality - occ.formality) / 1.4) ** 2)) + 0.5 * garmentAffinity(g, env.prefs) + (mustKeep?.(g) ? 1 : 0) }))
    .sort((a, b) => b.v - a.v);
  const types = new Set(items.map((g) => g.type));
  const perType = Math.max(2, Math.ceil(limit / Math.max(1, types.size)) + 1);
  const counts = new Map();
  const out = [];
  for (const { g } of ranked) {
    const n = counts.get(g.type) || 0;
    if (n >= perType) continue;
    counts.set(g.type, n + 1);
    out.push(g);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Generate and fully score candidate outfits.
 *
 * @param {object} args
 * @param {object[]} args.garments        prepared garments
 * @param {object} args.ctx               from buildContext
 * @param {string} args.occasion
 * @param {object} args.prefs             from normalizePrefs
 * @param {Map<string,number>} args.lastWorn
 * @param {Map<string,number>} args.avoid
 * @param {Set<string>} args.recentKeys
 * @param {() => number} args.rand
 * @param {(parts: object) => boolean} [args.accept]   hard filter on final candidates
 * @param {(parts: object) => number} [args.bonus]     additive score adjustment (0–~0.2)
 * @param {(core: object) => number} [args.coreBonus]   additive stage-1 adjustment (lets looks built around owned items surface)
 * @param {(g: object) => boolean} [args.mustKeep]    items never dropped by shortlisting
 * @param {{tops?:number,bottoms?:number,dresses?:number}} [args.caps]  shortlist sizes for very large pools
 */
export function generate(args) {
  const { garments, ctx, occasion, prefs, lastWorn, avoid, recentKeys, rand } = args;
  const env = { ctx, occasion, prefs, lastWorn, avoid, recentKeys, key: '' };

  const caps = args.caps || {};
  const keepAlways = (g) => (heavyWetKeep(g) || args.mustKeep?.(g));
  const heavyWetKeep = (g) => (ctx.rain === 'heavy' || ctx.snow) && g.waterproof;
  const cap = (items, limit) => (limit && items.length > limit ? diverseShortlist(items, limit, env, keepAlways) : items);

  const tops = cap(byCategory(garments, 'top'), caps.tops);
  const bottoms = cap(byCategory(garments, 'bottom'), caps.bottoms);
  const dresses = cap(byCategory(garments, 'dress'), caps.dresses);
  const outers = byCategory(garments, 'outerwear');
  const shoes = byCategory(garments, 'shoes');

  const heavyWet = ctx.rain === 'heavy' || ctx.snow;
  const wetKeep = (g) => heavyWet && g.waterproof;
  const keep = (g) => wetKeep(g) || args.mustKeep?.(g);

  const outerChoices = [null, ...quickRank(outers, env, MAX_OUTERS, keep)];
  const shoeChoices = shoes.length ? quickRank(shoes, env, MAX_SHOES, keep) : [null];
  const shoeRef = { category: 'shoes', warmth: 2, formality: 2.5, color: '#888888', id: '_ref', accessories: [] };

  // ── stage 1: cores ──────────────────────────────────────────────────
  const cores = [];
  const uppers = upperSets(tops, ctx, (items, limit) => (items.length > limit ? diverseShortlist(items, limit, env, keepAlways) : items));
  const baseParts = (core) => ({ ...emptyParts(), ...core });

  const coreList = [];
  for (const u of uppers) for (const b of bottoms) coreList.push({ upper: u, bottom: b });
  for (const d of dresses) {
    coreList.push({ upper: [], dress: d });
    // a dress with a light layer (cardigan, sweater) on cool days
    if (ctx.minFeels < 17 || ctx.avgFeels < 20) {
      for (const t of tops) if ((t.layer === 'mid' || t.layer === 'either') && t.warmth >= 2) coreList.push({ upper: [t], dress: d });
    }
  }

  for (const core of coreList) {
    const parts = baseParts(core);
    let bestThermal = null;
    for (const outer of outerChoices) {
      const t = thermalScore({ ...parts, outer, shoes: shoeRef }, ctx);
      if (!bestThermal || t.score > bestThermal) bestThermal = t.score;
    }
    const occ = occasionScore(parts, occasion, 'always').score;
    const col = harmonyScore(parts).score;
    const sty = styleScore(parts, prefs);
    const fresh = freshnessScore(parts, '', lastWorn, avoid, new Set());
    const s1 =
      (args.coreBonus ? args.coreBonus(core) : 0) +
      WEIGHTS.thermal * bestThermal +
      WEIGHTS.occasion * occ +
      WEIGHTS.harmony * col +
      WEIGHTS.style * sty +
      WEIGHTS.fresh * fresh;
    cores.push({ core, s1 });
  }
  cores.sort((a, b) => b.s1 - a.s1);

  // keep the best cores but stop a single hero piece from filling the shortlist
  const perPiece = new Map();
  const shortlist = [];
  for (const c of cores) {
    const lead = (c.core.dress || c.core.upper[0] || c.core.bottom)?.id;
    const n = perPiece.get(lead) || 0;
    if (n >= 7) continue;
    perPiece.set(lead, n + 1);
    shortlist.push(c);
    if (shortlist.length >= MAX_CORES) break;
  }

  // ── stage 2: complete outfits ───────────────────────────────────────
  const results = [];
  for (const { core } of shortlist) {
    for (const outer of outerChoices) {
      for (const shoe of shoeChoices) {
        const parts = { ...baseParts(core), outer, shoes: shoe };
        if (args.accept && !args.accept(parts)) continue;
        const key = outfitKey(parts);
        env.key = key;
        const scores = scoreParts(parts, env);
        // never suggest carrying a layer the day would not call for
        if (outer && scores.thermal.outer === 'never') continue;
        const total = scores.total + (args.bonus ? args.bonus(parts) : 0) + (rand() - 0.5) * 0.03;
        results.push({ parts, key, scores, total });
      }
    }
  }
  results.sort((a, b) => b.total - a.total);
  return results;
}

/** How far below the best outfit a suggestion may fall and still be shown. */
const QUALITY_WINDOW = 0.25;

const overlap = (a, b) => {
  const A = new Set(a.split('|'));
  const B = new Set(b.split('|'));
  let shared = 0;
  for (const x of A) if (B.has(x)) shared += 1;
  return shared / (A.size + B.size - shared);
};

/** Greedy diverse selection: no two chosen outfits may share more than `maxOverlap` of their pieces. */
export function pickDiverse(results, count, maxOverlap = 0.5) {
  const chosen = [];
  // relaxing the overlap rule must never pull in an outfit far worse than the best one;
  // better to show fewer looks than a bad one (results arrive best-first)
  const floor = results.length ? results[0].total - QUALITY_WINDOW : -Infinity;
  for (const limit of [maxOverlap, 0.7, 1.01]) {
    for (const r of results) {
      if (r.total < floor && chosen.length > 0) break;
      if (chosen.length >= count) break;
      if (chosen.includes(r)) continue;
      if (chosen.every((c) => overlap(c.key, r.key) <= limit)) chosen.push(r);
    }
    if (chosen.length >= count) break;
  }
  return chosen;
}

/** Add weather-driven accessories the person actually owns. */
export function pickAccessories(parts, ctx, occasion, prefs, accessories, rand) {
  const chosen = [];
  const owned = (fn) => accessories.filter((a) => a.accFn === fn || a._accFn === fn);
  const best = (list) => {
    if (!list.length) return null;
    let top = null;
    let topScore = -1;
    for (const a of list) {
      const trial = { ...parts, accessories: [...chosen, a] };
      const s = harmonyScore(trial).score * 0.6 + garmentAffinity(a, prefs) * 0.4 + rand() * 0.02;
      if (s > topScore) {
        topScore = s;
        top = a;
      }
    }
    return top;
  };
  const addType = (types, max) => {
    let added = 0;
    for (const t of types) {
      if (added >= max) break;
      const pick = best(accessories.filter((a) => a.type === t && !chosen.includes(a)));
      if (pick) {
        chosen.push(pick);
        added += 1;
      }
    }
  };

  if (ctx.minFeels <= -3) addType(['scarf', 'beanie', 'gloves'], 3);
  else if (ctx.minFeels <= 6) addType(['scarf', 'beanie'], 2);
  else if (ctx.minFeels <= 11 && ctx.swing > 6) addType(['scarf'], 1);

  if (ctx.maxUv >= 6 && ctx.rain === 'none') {
    addType(['sunglasses'], 1);
    if (ctx.maxUv >= 7) addType(['sunhat', 'cap'], 1);
  }
  if (ctx.rain !== 'none' && !ctx.snow) addType(['umbrella'], 1);

  if (['work', 'evening', 'formal'].includes(occasion)) {
    if (parts.bottom && owned('style').some((a) => a.type === 'belt')) addType(['belt'], 1);
    addType(['watch', 'bag'], 1);
  }
  return chosen.slice(0, 4);
}

const tempText = (c, units) => (units === 'imperial' ? `${Math.round(cToF(c))}°` : `${Math.round(c)}°`);

// Words slotted into the sentences below. L() marks them for the translation files.
const STYLE_WORD = { minimal: L('minimal'), classic: L('classic'), casual: L('casual'), sporty: L('sporty'), street: L('streetwear'), polished: L('polished'), boho: L('boho') };
const OCCASION_WORD = { casual: L('everyday wear'), work: L('work'), evening: L('dinner / evening'), formal: L('formal event'), active: L('active') };

function explain({ parts, scores, ctx, occasion, prefs, units }) {
  const { t, locale } = ctx;
  const reasons = [];
  const warnings = [];
  const range =
    Math.round(ctx.minFeels) === Math.round(ctx.maxFeels)
      ? tempText(ctx.minFeels, units)
      : t('{low} to {high}', { low: tempText(ctx.minFeels, units), high: tempText(ctx.maxFeels, units) });
  // German nouns keep their capital letter; everywhere else item names read better in lower case mid-sentence
  const lower = (name) => (locale === 'de' ? name : name.toLowerCase());

  const th = scores.thermal;
  if (parts.outer && th.outer === 'sometimes') {
    const hrs = th.outerOnHours;
    const morning = hrs.length && hrs[0] === ctx.hours[0].hour;
    const evening = hrs.length && hrs[hrs.length - 1] === ctx.hours[ctx.hours.length - 1].hour;
    const item = lower(parts.outer.name);
    let text;
    if (morning && !evening) text = t('Built for {range} with a removable {item}. Wear it through {time}, then it can come off.', { range, item, time: fmtHour(hrs[hrs.length - 1] + 1, locale) });
    else if (evening && !morning) text = t('Built for {range} with a removable {item}. You’ll want it from about {time}.', { range, item, time: fmtHour(hrs[0], locale) });
    else text = t('Built for {range} with a removable {item}.', { range, item });
    reasons.push({ kind: 'weather', text });
  } else if (parts.outer && th.outer === 'always') {
    reasons.push({ kind: 'weather', text: t('The {item} keeps you comfortable all day at {range}.', { item: lower(parts.outer.name), range }) });
  } else if (th.score >= 0.7) {
    reasons.push({ kind: 'weather', text: parts.outer ? t('Right for {range}.', { range }) : t('Right for {range}, no jacket needed.', { range }) });
  }

  if (ctx.rain !== 'none' || ctx.snow) {
    const wetOuter = parts.outer?.waterproof;
    const wetShoes = parts.shoes?.waterproof;
    if (wetOuter && wetShoes) {
      const vars = { outer: lower(parts.outer.name), shoes: lower(parts.shoes.name) };
      reasons.push({ kind: 'protection', text: ctx.snow ? t('Waterproof {outer} and {shoes} for the snow.', vars) : t('Waterproof {outer} and {shoes} for the rain.', vars) });
    } else if (wetOuter) reasons.push({ kind: 'protection', text: t('{item} keeps you dry.', { item: parts.outer.name }) });
    else if (wetShoes) reasons.push({ kind: 'protection', text: t('{item} can handle wet ground.', { item: parts.shoes.name }) });
    if (parts.shoes?.open) warnings.push(t('{item} will get wet today.', { item: parts.shoes.name }));
    if (!wetOuter && ctx.rain === 'heavy' && !parts.accessories.some((a) => a.type === 'umbrella')) {
      warnings.push(t('No waterproof layer in this look. Take an umbrella.'));
    }
  }

  if (scores.color.note && scores.color.score >= 0.8) reasons.push({ kind: 'color', text: `${t(scores.color.note)}.` });

  if (prefs.hasProfile) {
    const tally = {};
    for (const g of mainPieces(parts)) for (const tag of g.styles || []) tally[tag] = (tally[tag] || 0) + 1;
    const top = Object.entries(tally)
      .filter(([tag]) => (prefs.archetypes[tag] ?? 0.5) >= 0.65)
      .sort((a, b) => b[1] - a[1])[0];
    if (top && scores.style >= 0.6) reasons.push({ kind: 'style', text: t('Leans {style}, a style you told us you love.', { style: t(STYLE_WORD[top[0]] ?? top[0]) }) });
  }

  if (scores.occasion.score >= 0.82) {
    reasons.push({ kind: 'occasion', text: t('Right level of dressed-up for {occasion}.', { occasion: t(OCCASION_WORD[occasion] ?? OCCASIONS[occasion].label.toLowerCase()) }) });
  } else if (scores.occasion.spread >= 2.5) {
    warnings.push(t('Some pieces here are much dressier than others.'));
  }

  const forgotten = [...mainPieces(parts), parts.outer].filter((g) => g && g.wearCount > 0 && (g.idleDays ?? 0) >= DORMANT_DAYS).sort((a, b) => b.idleDays - a.idleDays)[0];
  if (forgotten) {
    reasons.push({ kind: 'fresh', text: t('Brings back {item}, which you last wore {when}.', { item: lower(forgotten.name), when: agoText(forgotten.idleDays, locale) }) });
  } else if (scores.fresh >= 0.97 && mainPieces(parts).some((g) => !g.wearCount)) {
    reasons.push({ kind: 'fresh', text: t('Includes pieces you have not worn yet.') });
  }
  if (scores.color.score < 0.5 && scores.color.note) warnings.push(`${t(scores.color.note)}.`);

  // a sentence that opens with an item name must still start with a capital, in every language
  const sentence = (s) => s.replace(/^./u, (c) => c.toUpperCase());
  return { reasons: reasons.slice(0, 4).map((r) => ({ ...r, text: sentence(r.text) })), warnings: warnings.map(sentence) };
}

const idsOf = (parts) => ({
  upper: parts.upper.map((g) => g.id),
  bottom: parts.bottom?.id ?? null,
  dress: parts.dress?.id ?? null,
  outer: parts.outer?.id ?? null,
  shoes: parts.shoes?.id ?? null,
  accessories: parts.accessories.map((g) => g.id)
});

function itemIds(parts) {
  return [...parts.upper, parts.dress, parts.bottom, parts.outer, parts.shoes, ...parts.accessories].filter(Boolean).map((g) => g.id);
}

/** Which categories a closet needs before any outfit can be built. */
export function missingEssentials(garments) {
  const has = (c) => garments.some((g) => g.category === c);
  const missing = [];
  if (!has('top') && !has('dress')) missing.push('top');
  if (!has('bottom') && !has('dress')) missing.push('bottom');
  return missing;
}

/**
 * Recommend outfits for one day.
 *
 * @param {object} args
 * @param {object[]} args.garments    stored garments (camelCase)
 * @param {object} args.day           normalised forecast day
 * @param {string} [args.occasion]
 * @param {object|null} [args.profile]
 * @param {Set<string>} [args.blockedKeys]  outfits the person rejected; never returned
 * @param {object} [args.prefs]       pre-built prefs (profile + learned taste); overrides profile
 * @param {{lastWorn?:Record<string,number>, recentKeys?:string[]}} [args.history]
 * @param {Map<string,number>} [args.avoid]
 * @param {number|string} [args.seed]
 * @param {number} [args.count]
 * @param {'metric'|'imperial'} [args.units]
 * @param {number|null} [args.nowHour]
 */
export function recommend(args) {
  const occasion = OCCASIONS[args.occasion] ? args.occasion : 'casual';
  const units = args.units || 'metric';
  const garments = prepareGarments(args.garments);
  const ctx = buildContext(args.day, { units, nowHour: args.nowHour ?? null, t: args.t, locale: args.locale });
  const tips = dayTips(ctx);
  const missing = missingEssentials(garments);
  const summary = {
    date: ctx.date,
    minFeels: ctx.minFeels,
    maxFeels: ctx.maxFeels,
    rain: ctx.rain,
    snow: ctx.snow,
    swing: ctx.swing
  };
  if (missing.length) return { outfits: [], tips, context: summary, missing };

  const prefs = args.prefs || normalizePrefs(args.profile);
  const lastWorn = new Map(Object.entries(args.history?.lastWorn || {}));
  const recentKeys = new Set(args.history?.recentKeys || []);
  const seed = hashString(`${args.seed ?? 'default'}|${ctx.date}|${occasion}`);
  const rand = rng(seed);
  const accessories = garments
    .filter((g) => g.category === 'accessory')
    .map((g) => ({ ...g, _accFn: g.accFn }));

  const featureId = args.featureId ?? null;
  const feature = featureId ? garments.find((g) => g.id === featureId) : null;
  if (featureId && !feature) return { outfits: [], tips, context: summary, missing: [], featureMissing: true };

  const results = generate({
    garments: garments.filter((g) => g.category !== 'accessory'),
    ctx,
    occasion,
    prefs,
    lastWorn,
    avoid: args.avoid || new Map(),
    recentKeys,
    rand,
    // a very large closet is shortlisted (diversely) so the combinations stay bounded
    caps: { tops: 40, bottoms: 36, dresses: 24 },
    mustKeep: feature ? (g) => g.id === featureId : undefined,
    // rank the combinations that wear the chosen piece first, so they survive the shortlist
    coreBonus: feature ? (core) => ([...core.upper, core.bottom, core.dress].some((g) => g?.id === featureId) ? 1 : 0) : undefined
  });

  const blocked = args.blockedKeys;
  let allowed = blocked?.size ? results.filter((r) => !blocked.has(r.key)) : results;
  // "style this piece": only outfits that wear it (an accessory is added to the best outfits instead)
  if (feature && feature.category !== 'accessory') allowed = allowed.filter((r) => itemIds(r.parts).includes(featureId));
  const chosen = pickDiverse(allowed, args.count ?? 3);
  const outfits = chosen.map((r) => {
    let accs = pickAccessories(r.parts, ctx, occasion, prefs, accessories, rand);
    if (feature?.category === 'accessory' && !accs.some((a) => a.id === featureId)) accs = [...accs.slice(0, 3), accessories.find((a) => a.id === featureId)];
    const parts = { ...r.parts, accessories: accs };
    const env = { ctx, occasion, prefs, lastWorn, avoid: args.avoid || new Map(), recentKeys, key: r.key };
    const scores = scoreParts(parts, env);
    const { reasons, warnings } = explain({ parts, scores, ctx, occasion, prefs, units });
    return {
      id: hashString(r.key).toString(36),
      key: r.key,
      score: Math.round(Math.max(0, Math.min(1, scores.total)) * 100),
      slots: idsOf(parts),
      itemIds: itemIds(parts),
      outerMode: scores.thermal.outer,
      components: {
        weather: Math.round(scores.thermal.score * 100),
        protection: Math.round(scores.protection * 100),
        occasion: Math.round(scores.occasion.score * 100),
        color: Math.round(scores.color.score * 100),
        style: Math.round(scores.style * 100),
        fresh: Math.round(scores.fresh * 100)
      },
      reasons,
      warnings
    };
  });

  // accessories shift scores slightly, so order by the final number
  outfits.sort((a, b) => b.score - a.score);
  return { outfits, tips, context: summary, missing: [], featureMissing: Boolean(feature) && outfits.length === 0 };
}

export { requiredInsulation };
