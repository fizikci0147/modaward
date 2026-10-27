/**
 * Forgiving food search for /trackweight. Pure functions, shared by the page and the tests.
 *
 * Matches regardless of case, accents ("borek" finds "Börek") and plurals ("burritos"), understands
 * a few British, Australian and American words for the same food ("crisps", "aubergine", "mince"),
 * and tolerates a typo or two ("buritos", "chiken"). Every word typed must match something in the
 * food's name; results are ranked, best first.
 */

export const normalise = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** A crude singular: burritos → burrito, sandwiches → sandwich, berries → berry, but never "glass" → "gla". */
export function stem(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|xes|sses|oes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

/** Other words people use for the same food (all already normalised and stemmed). */
const ALIASES = {
  crisp: ['chip'],
  chip: ['fry', 'crisp'],
  fry: ['chip'],
  aubergine: ['eggplant'],
  courgette: ['zucchini'],
  coriander: ['cilantro'],
  mince: ['ground'],
  prawn: ['shrimp'],
  biscuit: ['cookie'],
  rocket: ['arugula'],
  capsicum: ['pepper'],
  sweetcorn: ['corn'],
  yoghurt: ['yogurt'],
  porridge: ['oatmeal', 'oat'],
  soda: ['cola', 'soft'],
  pop: ['cola', 'soda'],
  doner: ['kebab', 'shawarma', 'gyro'],
  shawarma: ['doner', 'gyro'],
  gyro: ['doner', 'shawarma'],
  wrap: ['burrito', 'tortilla'],
  takeaway: ['takeout'],
  lolly: ['candy'],
  sweet: ['candy'],
  pudding: ['dessert'],
  pilau: ['pilaf', 'pilav'],
  pilav: ['pilaf', 'pilau'],
  cappucino: ['cappuccino'],
  expresso: ['espresso'],
  hamburguer: ['hamburger'],
};

/** Damerau–Levenshtein distance, giving up once it must exceed `max`. */
export function distance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      row[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = row;
  }
  return prev[b.length];
}

const wordCache = new Map();
const words = (text) => {
  let w = wordCache.get(text);
  if (!w) {
    w = normalise(text).split(' ').filter(Boolean).map(stem);
    if (wordCache.size > 5000) wordCache.clear();
    wordCache.set(text, w);
  }
  return w;
};

/** How well one typed word matches a food's words and full name: 0 (not at all) to 3 (a whole word). */
function tokenScore(token, nameWords, haystack) {
  const options = [token, ...(ALIASES[token] ?? [])];
  let best = 0;
  for (const t of options) {
    for (const w of nameWords) {
      if (w === t) best = Math.max(best, 3);
      else if (w.startsWith(t)) best = Math.max(best, 2.4);
    }
    if (best < 2 && t.length >= 3 && haystack.includes(t)) best = Math.max(best, 1.6);
    if (best < 1 && t.length >= 4) {
      const allowed = t.length >= 8 ? 2 : 1;
      for (const w of nameWords) if (w.length >= 3 && distance(t, w, allowed) <= allowed) best = Math.max(best, 1);
    }
  }
  return best;
}

/**
 * Rank `items` for a typed query. Items that do not match every word are left out. Equal scores keep
 * their original order, so put the person's own foods first.
 * @param {T[]} items
 * @param {string} query
 * @param {(item: T) => string} [textOf] the words to search in (default: the item's name)
 * @param {number} [limit]
 * @returns {T[]}
 * @template T
 */
export function rankFoods(items, query, textOf = (f) => f.name, limit = 80) {
  const tokens = words(query);
  if (!tokens.length) return [];
  const scored = [];
  items.forEach((item, index) => {
    const text = textOf(item);
    const nameWords = words(text);
    const haystack = normalise(text);
    let total = 0;
    for (const t of tokens) {
      const s = tokenScore(t, nameWords, haystack);
      if (!s) return;
      total += s;
    }
    // a name that starts with what was typed, and shorter names, come first
    if (haystack.startsWith(normalise(query))) total += 2;
    total -= nameWords.length * 0.05;
    scored.push({ item, index, total });
  });
  scored.sort((a, b) => b.total - a.total || a.index - b.index);
  return scored.slice(0, limit).map((s) => s.item);
}
