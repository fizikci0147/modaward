import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { partial, object, string, number, integer, boolean, oneOf, arrayOf, record, nullable } from '../../util/validate.js';
import { ARCHETYPE_IDS, PATTERNS } from '../../shared/taxonomy.js';
import { PALETTE } from '../../shared/color.js';
import {
  DEPARTMENTS, UNITS, CURRENCIES, AGE_RANGES, FIT_TOPS, FIT_BOTTOMS, BODY_AREAS, SHOP_OCCASIONS, DRESS_CODES, NEVER_TAGS, BUDGET_TIERS, mergeProfile, completeness
} from '../../shared/profile.js';
import { RETAILER_IDS } from '../../shop/retailers.js';
import { badRequest } from '../../util/errors.js';
import { LOCALES } from '../../shared/i18n.js';

const colorNames = PALETTE.map((p) => p.name);
const size = () => string({ max: 12 });
const price = () => integer({ min: 10, max: 2000 });
const brand = () => string({ min: 1, max: 30 });

export const profilePatchSchema = partial({
  department: oneOf(DEPARTMENTS),
  units: oneOf(UNITS),
  currency: oneOf(CURRENCIES),
  locale: nullable(oneOf(Object.keys(LOCALES))),
  location: nullable(object({ name: string({ min: 1, max: 80 }), lat: number({ min: -90, max: 90 }), lon: number({ min: -180, max: 180 }), timezone: string({ max: 60 }) })),
  workDays: arrayOf(integer({ min: 0, max: 6 }), { max: 7, unique: true }),
  ageRange: nullable(oneOf(AGE_RANGES)),
  heightCm: nullable(number({ min: 90, max: 230 })),
  sizes: partial({ top: size(), bottom: size(), dress: size(), shoe: size(), outerwear: size() }),
  fit: partial({ tops: oneOf(FIT_TOPS), bottoms: oneOf(FIT_BOTTOMS) }),
  bodyAreas: partial({ show: arrayOf(oneOf(Object.keys(BODY_AREAS)), { max: 6, unique: true }), cover: arrayOf(oneOf(Object.keys(BODY_AREAS)), { max: 6, unique: true }) }),
  lifestyle: partial({ occasions: arrayOf(oneOf(Object.keys(SHOP_OCCASIONS)), { max: 7, unique: true }), dressCode: oneOf(Object.keys(DRESS_CODES)) }),
  budget: partial({ tier: oneOf(Object.keys(BUDGET_TIERS)), top: price(), bottom: price(), dress: price(), outerwear: price(), shoes: price() }),
  style: partial({
    archetypes: record(oneOf(ARCHETYPE_IDS), number({ min: 0, max: 1 }), { max: 7 }),
    likedColors: arrayOf(oneOf(colorNames), { max: 8, unique: true }),
    avoidedColors: arrayOf(oneOf(colorNames), { max: 8, unique: true }),
    avoidedPatterns: arrayOf(oneOf(PATTERNS), { max: 8, unique: true }),
    never: arrayOf(oneOf(Object.keys(NEVER_TAGS)), { max: 12, unique: true }),
    brands: partial({ love: arrayOf(brand(), { max: 15, unique: true }), avoid: arrayOf(brand(), { max: 15, unique: true }) }),
    stores: arrayOf(oneOf(RETAILER_IDS), { max: 14, unique: true }),
    mixStores: boolean(),
    quizDone: boolean(),
    notes: string({ max: 600 })
  })
});

/** Apply a validated patch: nested objects merge, arrays and scalars replace. */
export function applyProfilePatch(current, patch) {
  const next = mergeProfile(current, patch);
  if (patch.fit) next.fit.set = true;
  if (patch.budget) {
    next.budget.set = true;
    // choosing a tier without explicit prices applies that tier's per-category caps
    if (patch.budget.tier && !Object.keys(patch.budget).some((k) => k !== 'tier')) Object.assign(next.budget, BUDGET_TIERS[patch.budget.tier].caps);
  }
  // keep liked and avoided colours disjoint: the most recent choice wins
  if (patch.style?.likedColors) next.style.avoidedColors = next.style.avoidedColors.filter((c) => !patch.style.likedColors.includes(c));
  if (patch.style?.avoidedColors) next.style.likedColors = next.style.likedColors.filter((c) => !patch.style.avoidedColors.includes(c));
  if (next.bodyAreas.show.some((a) => next.bodyAreas.cover.includes(a))) {
    throw badRequest('An area can be shown off or covered, not both.');
  }
  return next;
}

export function profileRoutes({ repos, weather }) {
  const r = Router();
  r.use(['/profile', '/geo'], requireUser);

  r.get('/profile', (req, res) => {
    const profile = repos.profiles.get(req.user.id);
    res.json({ profile, completeness: completeness(profile) });
  });

  r.patch('/profile', (req, res) => {
    const patch = profilePatchSchema(req.body);
    const next = applyProfilePatch(repos.profiles.get(req.user.id), patch);
    repos.profiles.save(req.user.id, next);
    res.json({ profile: next, completeness: completeness(next) });
  });

  const geoLimit = rateLimit({ windowMs: 60_000, max: 40, key: (req) => req.user?.id || req.ip, message: 'Too many requests. Please slow down.' });
  r.get('/geo/search', geoLimit, async (req, res) => {
    const q = string({ min: 2, max: 80 })(req.query.q, 'q');
    res.json({ results: await weather.geocode(q, req.locale) });
  });

  return r;
}
