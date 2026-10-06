/**
 * Learned taste model.
 *
 * An online logistic-regression model over hashed-free, human-readable features. Every time
 * someone loves, dislikes, wears or saves a look, the model takes a gradient step, so
 * recommendations adapt to the person within a handful of interactions — no external AI
 * service, no per-request cost, works offline.
 *
 * Features describe *pieces* (type, colour, pattern, formality band, brand) and *pairings*
 * (top type × bottom type, colour pair), so the model can learn both "likes navy" and
 * "likes oversized hoodies with straight jeans".
 */
import { colorName, colorRole, hexToHsl } from '../shared/color.js';

const MAX_FEATURES = 1500;
const L2 = 0.0008;
const BASE_RATE = 0.35;

const bucket = (v) => (v < 2 ? 'casual' : v < 3.2 ? 'relaxed' : v < 4.2 ? 'smart' : 'dressy');

/**
 * Describe a set of garments as a list of feature keys.
 * Works for owned garments and shop pieces alike (anything with type/color/pattern/formality).
 * @param {object[]} items
 */
export function features(items) {
  const f = new Set();
  const main = items.filter((g) => g && g.category !== 'accessory');
  for (const g of items) {
    if (!g) continue;
    f.add(`type:${g.type}`);
    const name = g.colorName || colorName(g.color);
    f.add(`color:${name}`);
    f.add(`role:${colorRole(g.color)}`);
    if (g.pattern && g.pattern !== 'solid') f.add(`pattern:${g.pattern}`);
    if (g.brand) f.add(`brand:${String(g.brand).toLowerCase().slice(0, 30)}`);
    if (g.category) f.add(`cat:${g.category}:${bucket(g.formality ?? 2.5)}`);
    for (const s of g.styles || []) f.add(`style:${s}`);
    const { l } = hexToHsl(g.color);
    f.add(`tone:${g.category}:${l < 0.3 ? 'dark' : l > 0.7 ? 'light' : 'mid'}`);
  }

  const top = main.find((g) => g.category === 'top');
  const bottom = main.find((g) => g.category === 'bottom');
  const shoes = main.find((g) => g.category === 'shoes');
  const outer = main.find((g) => g.category === 'outerwear');
  if (top && bottom) {
    f.add(`pair:${top.type}+${bottom.type}`);
    f.add(`cpair:${top.colorName || colorName(top.color)}+${bottom.colorName || colorName(bottom.color)}`);
  }
  if (bottom && shoes) f.add(`pair:${bottom.type}+${shoes.type}`);
  if (top && outer) f.add(`pair:${top.type}+${outer.type}`);

  const forms = main.map((g) => g.formality ?? 2.5);
  if (forms.length) {
    const spread = Math.max(...forms) - Math.min(...forms);
    f.add(`spread:${spread < 1 ? 'tight' : spread < 2 ? 'mixed' : 'wide'}`);
  }
  return [...f];
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export const SIGNALS = Object.freeze({
  love: 1,
  wear: 0.85,
  save: 0.8,
  like: 0.7,
  skip: -0.35,
  dislike: -1
});

export class TasteModel {
  /** @param {{w?:Record<string,number>, b?:number, n?:number}} [state] */
  constructor(state = {}) {
    this.w = state.w || {};
    this.b = state.b ?? Math.log(BASE_RATE / (1 - BASE_RATE));
    this.n = state.n || 0;
  }

  /** Raw log-odds that the person will like a set of items. */
  logit(items) {
    let z = this.b;
    for (const k of features(items)) z += this.w[k] || 0;
    return z;
  }

  /** Probability the person will like a set of items, 0–1. */
  predict(items) {
    return sigmoid(this.logit(items));
  }

  /**
   * Ranking score, 0–1 with 0.5 meaning "no opinion". Computed in log-odds space and softened
   * so it never saturates: a model that has only ever seen dislikes still ranks outfits by
   * how *much* they resemble the disliked ones.
   */
  score(items) {
    return sigmoid((this.logit(items) - this.b) / 2.5);
  }

  /** How much to trust the model: 0 with no data, 1 after ~25 signals. */
  get confidence() {
    return Math.min(1, this.n / 25);
  }

  /**
   * One SGD step.
   * @param {object[]} items
   * @param {keyof typeof SIGNALS} signal
   */
  learn(items, signal) {
    const target = SIGNALS[signal];
    if (target === undefined) throw new Error(`Unknown signal "${signal}"`);
    const y = target > 0 ? 1 : 0;
    const strength = Math.abs(target);
    const feats = features(items);
    const p = this.predict(items);
    const rate = (0.9 / Math.sqrt(1 + this.n / 6)) * strength;
    const err = y - p;
    for (const k of feats) {
      const w = this.w[k] || 0;
      this.w[k] = w + rate * (err - L2 * w * 10);
    }
    // the bias stays at its prior: with one-sided feedback it would otherwise absorb everything
    this.n += 1;
    this.#prune();
    return this;
  }

  /** Strongest learned likes and dislikes, for "your style DNA" and for explanations. */
  insights(limit = 6) {
    const entries = Object.entries(this.w).filter(([k]) => /^(type|color|pattern|brand|style|pair|cpair):/.test(k));
    entries.sort((a, b) => b[1] - a[1]);
    const likes = entries.filter(([, v]) => v > 0.25).slice(0, limit);
    const dislikes = entries
      .filter(([, v]) => v < -0.25)
      .slice(-limit)
      .reverse();
    const fmt = ([k, v]) => ({ feature: k, weight: Math.round(v * 100) / 100 });
    return { likes: likes.map(fmt), dislikes: dislikes.map(fmt), signals: this.n };
  }

  #prune() {
    const keys = Object.keys(this.w);
    if (keys.length <= MAX_FEATURES) return;
    keys.sort((a, b) => Math.abs(this.w[a]) - Math.abs(this.w[b]));
    for (const k of keys.slice(0, keys.length - MAX_FEATURES)) delete this.w[k];
  }

  toJSON() {
    const w = {};
    for (const [k, v] of Object.entries(this.w)) if (Math.abs(v) > 0.01) w[k] = Math.round(v * 1000) / 1000;
    return { w, b: Math.round(this.b * 1000) / 1000, n: this.n };
  }
}

/**
 * Blend the learned model into a prefs object so the engine's style score uses it.
 * With little data the quiz archetypes dominate; with more data the model takes over.
 * @param {object} prefs from normalizePrefs
 * @param {TasteModel|null} model
 */
export function withTaste(prefs, model) {
  if (!model || model.n < 3) return prefs;
  return { ...prefs, taste: model, tasteWeight: 0.25 + 0.55 * model.confidence };
}
