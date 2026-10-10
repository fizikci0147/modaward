/**
 * What is current, as data. A trend only ever NUDGES between outfits the person would already like:
 *   bonus = weight × relevance to their style × how much they like the outfit × their "trendiness" setting
 * so it can break a tie but never put something they dislike on top (see trendBonus in engine/scoring.js).
 *
 * The lists below were compiled in October 2026 from the Fall/Winter 2026 and Spring/Summer 2026
 * reporting of Net-a-Porter, JOOR, FASHION Magazine, Mango, LuisaViaRoma, Ape to Gentleman, H&M,
 * Rath & Co. and New York Fashion Week FW26 data. Fashion moves: the owner can replace or extend
 * them without code by putting a JSON file at DATA_DIR/trends.json (see docs/TRENDS.md).
 *
 * A trend is { id, label, weight, archetypes?, seasons?, match } where `match` is one of:
 *   { colors: [names], on?: 'main' | 'any' }       a palette colour on the main pieces (or any piece)
 *   { types: [garment types], on?: 'upper'|'main'|'any' }
 *   { patterns: [pattern ids] }                    on a top or bottom
 *   { tonal: 'black' | 'warm' }                    the main pieces all in one colour family
 *   { all: [match, ...] }                          every clause matches
 */
import { L } from './i18n.js';

export const TRENDS_UPDATED = '2026-10';

const FW = [
  { id: 'deep-red', label: L('deep burgundy'), weight: 0.04, match: { colors: ['burgundy', 'red', 'rust'] } },
  { id: 'purple', label: L('rich purple'), weight: 0.03, archetypes: ['polished', 'boho', 'classic', 'minimal'], match: { colors: ['purple', 'lavender'] } },
  { id: 'butter', label: L('butter yellow'), weight: 0.02, archetypes: ['boho', 'casual', 'polished'], match: { colors: ['yellow', 'mustard'] } },
  { id: 'warm-neutrals', label: L('camel and chocolate neutrals'), weight: 0.03, match: { colors: ['camel', 'brown', 'beige'] } },
  { id: 'tonal-warm', label: L('tonal neutrals head to toe'), weight: 0.04, archetypes: ['minimal', 'classic', 'polished'], match: { tonal: 'warm' } },
  { id: 'black-out', label: L('all-black dressing'), weight: 0.04, archetypes: ['minimal', 'polished', 'street'], match: { tonal: 'black' } },
  { id: 'knits', label: L('knitwear'), weight: 0.03, archetypes: ['classic', 'minimal', 'casual', 'boho', 'polished'], match: { types: ['sweater', 'cardigan'], on: 'upper' } },
  { id: 'shirt-knit', label: L('a shirt under a knit'), weight: 0.04, archetypes: ['classic', 'polished', 'minimal'], match: { all: [{ types: ['shirt', 'polo', 'blouse'], on: 'upper' }, { types: ['sweater', 'cardigan'], on: 'upper' }] } },
  { id: 'soft-tailoring', label: L('relaxed tailoring'), weight: 0.04, archetypes: ['classic', 'polished', 'casual', 'minimal', 'street'], match: { all: [{ types: ['blazer'] }, { types: ['sneakers', 'loafers', 'boots', 'chelsea'] }, { types: ['jeans', 'chinos', 'trousers'] }] } },
  { id: 'trench', label: L('the trench and utility rain jacket'), weight: 0.03, archetypes: ['classic', 'minimal', 'polished', 'casual'], match: { types: ['trench', 'raincoat'] } },
  { id: 'big-outerwear', label: L('big, sculptural outerwear'), weight: 0.025, archetypes: ['street', 'minimal', 'polished', 'casual'], match: { types: ['puffer', 'parka', 'wool-coat'] } },
  { id: 'rugby', label: L('rugby stripes'), weight: 0.03, archetypes: ['classic', 'casual', 'street'], match: { all: [{ patterns: ['striped'] }, { types: ['polo', 'longsleeve', 'sweater', 'tee'], on: 'upper' }] } },
  { id: 'muted-check', label: L('muted checks'), weight: 0.02, archetypes: ['classic', 'polished', 'boho'], match: { patterns: ['checked'] } },
  { id: 'denim-tailoring', label: L('denim with tailoring'), weight: 0.03, archetypes: ['classic', 'casual', 'street', 'minimal'], match: { all: [{ types: ['jeans'] }, { types: ['blazer', 'wool-coat', 'trench'] }] } },
  { id: 'loafers', label: L('loafers and polished boots'), weight: 0.025, archetypes: ['classic', 'polished', 'minimal'], match: { types: ['loafers', 'chelsea'] } }
];

const SS = [
  { id: 'cloud-dancer', label: L('warm off-white'), weight: 0.03, match: { colors: ['cream', 'white', 'beige'] } },
  { id: 'bold-colour', label: L('a bold colour'), weight: 0.03, archetypes: ['boho', 'casual', 'polished', 'street'], match: { colors: ['royal blue', 'red', 'teal', 'yellow', 'orange', 'sky blue'] } },
  { id: 'lilac', label: L('lilac and soft pastels'), weight: 0.02, archetypes: ['boho', 'polished', 'minimal'], match: { colors: ['lavender', 'blush', 'sage'] } },
  { id: 'florals', label: L('bold florals'), weight: 0.03, archetypes: ['boho', 'polished'], match: { patterns: ['floral'] } },
  { id: 'tailored-light', label: L('light tailoring'), weight: 0.03, archetypes: ['classic', 'polished', 'minimal'], match: { types: ['blazer'] } },
  { id: 'flats', label: L('slim flats and loafers'), weight: 0.03, archetypes: ['classic', 'polished', 'minimal', 'boho'], match: { types: ['flats', 'loafers'] } },
  { id: 'straight-denim', label: L('straight-leg denim'), weight: 0.02, archetypes: ['casual', 'minimal', 'classic', 'street'], match: { types: ['jeans'] } },
  { id: 'polo-knit', label: L('the polo'), weight: 0.025, archetypes: ['classic', 'casual', 'minimal'], match: { types: ['polo'] } },
  { id: 'dress-moment', label: L('a fluid dress'), weight: 0.03, archetypes: ['boho', 'polished', 'classic'], match: { types: ['dress', 'sundress', 'jumpsuit'] } },
  { id: 'tonal-light', label: L('tonal neutrals head to toe'), weight: 0.035, archetypes: ['minimal', 'classic', 'polished'], match: { tonal: 'warm' } }
];

const BUILT_IN = Object.freeze({ fw: FW, ss: SS });
let override = null;
let overrideUpdated = null; // 'YYYY-MM' the override was compiled

/** Replace or extend the built-in lists (called at start-up with the saved trends.json, and after each refresh). */
export function configureTrends(json) {
  const ok = (list) => Array.isArray(list) && list.every((t) => t && typeof t.id === 'string' && typeof t.label === 'string' && typeof t.weight === 'number' && t.match && typeof t.match === 'object');
  if (!json || typeof json !== 'object') {
    overrideUpdated = null;
    return (override = null);
  }
  const next = {};
  for (const key of ['fw', 'ss']) if (ok(json[key])) next[key] = json[key].map((t) => ({ ...t, weight: Math.max(0, Math.min(0.08, t.weight)) }));
  override = Object.keys(next).length ? next : null;
  overrideUpdated = override && /^\d{4}-\d{2}/.test(String(json.updatedAt || '')) ? String(json.updatedAt).slice(0, 7) : override ? TRENDS_UPDATED : null;
  return override;
}

/** Months since the lists in use were compiled. */
export function trendAgeMonths(now = new Date()) {
  const [y, m] = (overrideUpdated || TRENDS_UPDATED).split('-').map(Number);
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m);
}

/**
 * Fashion moves on: lists that are not refreshed fade out rather than keep steering people to
 * last year's looks. Full strength for six months, then fading to a quarter at eighteen.
 */
export function trendFreshness(now = new Date()) {
  const age = trendAgeMonths(now);
  return age <= 6 ? 1 : Math.max(0.25, 1 - (age - 6) / 16);
}

/** The label to show in a language: a translated one the list carries, else the English text. */
export const trendLabel = (trend, locale) => trend.labels?.[locale] ?? trend.label;

/** 'fw' (autumn/winter) or 'ss' (spring/summer) where the person lives. */
export function seasonOf(date, hemisphere = 'north') {
  const month = Number(String(date || '').slice(5, 7)) || new Date().getUTCMonth() + 1;
  const coldHalf = month >= 9 || month <= 2;
  return (hemisphere === 'south' ? !coldHalf : coldHalf) ? 'fw' : 'ss';
}

export const trendsFor = (season) => (override?.[season] ?? BUILT_IN[season] ?? []);
export const trendSets = () => ({ fw: trendsFor('fw'), ss: trendsFor('ss'), updated: overrideUpdated || TRENDS_UPDATED, custom: Boolean(override) });

// ── validating a list that came from outside (the automatic refresh) ────────────────────────────

const LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'tr'];
const clean = (text, max = 60) => String(text ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

/**
 * Keep only trends that use words this app understands and cannot do harm: real palette colours,
 * real garment types, known patterns and styles, a capped weight. Returns null when too little survives.
 * @param {unknown} json
 * @param {{colors:string[], types:string[], patterns:string[], archetypes:string[]}} vocab
 */
export function sanitizeTrendLists(json, vocab) {
  const colors = new Set(vocab.colors);
  const types = new Set(vocab.types);
  const patterns = new Set(vocab.patterns);
  const styles = new Set(vocab.archetypes);
  const list = (arr, allowed) => Array.isArray(arr) && arr.length > 0 && arr.length <= 12 && arr.every((x) => allowed.has(x));

  const validMatch = (m, depth = 0) => {
    if (!m || typeof m !== 'object' || Array.isArray(m) || depth > 2) return null;
    const on = ['main', 'any', 'upper'].includes(m.on) ? m.on : undefined;
    if (m.all) return Array.isArray(m.all) && m.all.length >= 2 && m.all.length <= 4 ? (() => {
      const parts = m.all.map((x) => validMatch(x, depth + 1));
      return parts.every(Boolean) ? { all: parts } : null;
    })() : null;
    if (m.colors) return list(m.colors, colors) ? { colors: m.colors, ...(on ? { on } : {}) } : null;
    if (m.types) return list(m.types, types) ? { types: m.types, ...(on ? { on } : {}) } : null;
    if (m.patterns) return list(m.patterns, patterns) ? { patterns: m.patterns } : null;
    if (m.tonal === 'black' || m.tonal === 'warm') return { tonal: m.tonal };
    return null;
  };

  const out = { fw: [], ss: [] };
  for (const key of ['fw', 'ss']) {
    const seen = new Set();
    for (const t of Array.isArray(json?.[key]) ? json[key] : []) {
      const id = clean(t?.id, 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const label = clean(t?.label);
      const match = validMatch(t?.match);
      const weight = Number(t?.weight);
      if (!id || seen.has(id) || !label || !match || !Number.isFinite(weight)) continue;
      seen.add(id);
      const labels = {};
      for (const code of LOCALES) if (t?.labels?.[code]) labels[code] = clean(t.labels[code]);
      const archetypes = Array.isArray(t.archetypes) ? t.archetypes.filter((a) => styles.has(a)) : [];
      out[key].push({ id, label, ...(Object.keys(labels).length ? { labels } : {}), weight: Math.max(0.01, Math.min(0.05, weight)), ...(archetypes.length ? { archetypes } : {}), match });
      if (out[key].length >= 20) break;
    }
  }
  return out.fw.length >= 6 && out.ss.length >= 6 ? out : null;
}
