/**
 * The style profile — modelled on the depth of a professional styling service intake:
 * sizes, fit by body area, what to show off or cover, per-category budgets, lifestyle and
 * occasions, hard "never" rules, brands, and free-text notes for the stylist.
 *
 * Shared by the server (validation, defaults, merge) and the browser (forms, completeness meter).
 */

export const DEPARTMENTS = Object.freeze(['women', 'men', 'unisex']);
export const UNITS = Object.freeze(['imperial', 'metric']);
export const AGE_RANGES = Object.freeze(['18-24', '25-34', '35-44', '45-54', '55+']);

export const FIT_TOPS = Object.freeze(['fitted', 'regular', 'relaxed', 'oversized']);
export const FIT_BOTTOMS = Object.freeze(['skinny', 'slim', 'straight', 'relaxed', 'wide']);

export const BODY_AREAS = Object.freeze({
  shoulders: 'Shoulders',
  arms: 'Arms',
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  legs: 'Legs'
});

export const SHOP_OCCASIONS = Object.freeze({
  work: 'Work',
  casual: 'Everyday casual',
  weekend: 'Weekends & errands',
  date: 'Date night',
  travel: 'Travel',
  active: 'Active & gym',
  events: 'Weddings & events'
});

export const DRESS_CODES = Object.freeze({
  casual: 'Casual: jeans and tees are fine',
  smart: 'Smart casual',
  business: 'Business professional',
  formal: 'Formal / suited'
});

/** Hard exclusions: a look containing any of these is never shown. */
export const NEVER_TAGS = Object.freeze({
  sleeveless: 'Sleeveless tops',
  shorts: 'Shorts',
  crop: 'Crop tops',
  heels: 'Heels',
  skinny: 'Skinny fits',
  graphic: 'Graphic prints',
  logos: 'Visible logos',
  bright: 'Very bright colours',
  wool: 'Wool',
  synthetics: 'Synthetic fabrics',
  leather: 'Leather'
});

export const BUDGET_TIERS = Object.freeze({
  value: { label: 'Value', hint: 'Smart, affordable basics', caps: { top: 35, bottom: 50, dress: 70, outerwear: 120, shoes: 80 } },
  mid: { label: 'Mid-range', hint: 'Quality everyday pieces', caps: { top: 70, bottom: 100, dress: 130, outerwear: 250, shoes: 150 } },
  premium: { label: 'Premium', hint: 'Investment pieces', caps: { top: 150, bottom: 200, dress: 300, outerwear: 500, shoes: 300 } }
});

export const BUDGET_CATEGORIES = Object.freeze(['top', 'bottom', 'dress', 'outerwear', 'shoes']);

export const DEFAULT_PROFILE = Object.freeze({
  department: 'unisex',
  units: 'imperial',
  location: null,
  workDays: [1, 2, 3, 4, 5],
  ageRange: null,
  heightCm: null,
  sizes: {},
  fit: { tops: 'regular', bottoms: 'straight', set: false },
  bodyAreas: { show: [], cover: [] },
  lifestyle: { occasions: [], dressCode: 'smart' },
  budget: { tier: 'mid', set: false, ...BUDGET_TIERS.mid.caps },
  style: {
    archetypes: {},
    likedColors: [],
    avoidedColors: [],
    avoidedPatterns: [],
    never: [],
    brands: { love: [], avoid: [] },
    stores: [],
    mixStores: true,
    quizDone: false,
    notes: ''
  }
});

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep-merge saved data over defaults so older saved profiles gain new fields safely. */
export function mergeProfile(base, saved) {
  const out = { ...base };
  for (const [k, v] of Object.entries(saved || {})) {
    out[k] = isPlain(v) && isPlain(base[k]) ? mergeProfile(base[k], v) : v;
  }
  return out;
}

/** Cost tier implied by the per-category budgets, used to rank retailers. */
export function budgetTier(profile) {
  const b = profile.budget || {};
  const score = BUDGET_CATEGORIES.reduce((s, c) => s + (b[c] ?? BUDGET_TIERS.mid.caps[c]) / BUDGET_TIERS.mid.caps[c], 0) / BUDGET_CATEGORIES.length;
  return score < 0.72 ? 'value' : score > 1.45 ? 'premium' : 'mid';
}

/**
 * How complete the profile is, and what to ask for next (most valuable first).
 * Weighted by how much each answer improves recommendations.
 * @returns {{percent:number, next:{key:string,label:string,section:string}[]}}
 */
export function completeness(profile) {
  const s = profile.style || {};
  const checks = [
    { key: 'quiz', label: 'Take the style quiz', section: 'style', weight: 22, done: Boolean(s.quizDone) },
    { key: 'location', label: 'Set your location for weather', section: 'basics', weight: 14, done: Boolean(profile.location) },
    { key: 'sizes', label: 'Add your sizes', section: 'sizes', weight: 12, done: Boolean(profile.sizes?.top || profile.sizes?.bottom || profile.sizes?.shoe) },
    { key: 'fit', label: 'Tell us how you like clothes to fit', section: 'fit', weight: 8, done: Boolean(profile.fit?.set) },
    { key: 'lifestyle', label: 'What do you dress for?', section: 'lifestyle', weight: 12, done: (profile.lifestyle?.occasions?.length || 0) > 0 },
    { key: 'colors', label: 'Pick colours you love and avoid', section: 'style', weight: 8, done: (s.likedColors?.length || 0) + (s.avoidedColors?.length || 0) > 0 },
    { key: 'budget', label: 'Set your budget', section: 'budget', weight: 6, done: Boolean(profile.budget?.set) },
    { key: 'bodyAreas', label: 'Show off or cover up: your call', section: 'fit', weight: 4, done: (profile.bodyAreas?.show?.length || 0) + (profile.bodyAreas?.cover?.length || 0) > 0 },
    { key: 'never', label: 'Anything we should never suggest?', section: 'style', weight: 4, done: (s.never?.length || 0) > 0 },
    { key: 'brands', label: 'Brands you love or avoid', section: 'style', weight: 4, done: (s.brands?.love?.length || 0) + (s.brands?.avoid?.length || 0) > 0 },
    { key: 'stores', label: 'Choose your favourite stores', section: 'style', weight: 3, done: (s.stores?.length || 0) > 0 },
    { key: 'notes', label: 'Leave a note for your stylist', section: 'style', weight: 3, done: Boolean(s.notes?.trim()) }
  ];
  const total = checks.reduce((n, c) => n + c.weight, 0);
  const got = checks.filter((c) => c.done).reduce((n, c) => n + c.weight, 0);
  return {
    percent: Math.round((got / total) * 100),
    next: checks.filter((c) => !c.done).sort((a, b) => b.weight - a.weight).map(({ key, label, section }) => ({ key, label, section }))
  };
}
