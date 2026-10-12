import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, string, integer, oneOf, optional, arrayOf, boolean } from '../../util/validate.js';
import { OCCASION_IDS } from '../../shared/taxonomy.js';
import { SIGNALS } from '../../ai/taste.js';
import { RETAILERS, CUSTOM_PREFIX } from '../../shop/retailers.js';
import { REGIONS, shopRegion } from '../../shop/regions.js';
import { checkStoreInput, builtInFor } from '../../shop/custom-stores.js';
import { HttpError, badRequest, conflict, notFound } from '../../util/errors.js';

const looksSchema = object({
  kind: optional(oneOf(['both', 'new', 'owned']), 'both'),
  storeMode: optional(oneOf(['mix', 'single']), undefined),
  occasions: optional(arrayOf(oneOf(OCCASION_IDS), { max: 5, unique: true }), undefined),
  seed: optional(string({ max: 40 }), undefined),
  limit: optional(integer({ min: 1, max: 36 }), 18),
  curate: optional(boolean(), true)
});
const gapsSchema = object({ storeMode: optional(oneOf(['mix', 'single']), undefined) });
const feedbackSchema = object({
  lookId: string({ min: 3, max: 40 }),
  signal: oneOf(['love', 'like', 'dislike', 'skip']),
  pieceIndex: optional(integer({ min: 0, max: 9 }), undefined)
});
const saveSchema = object({ lookId: string({ min: 3, max: 40 }) });

const MAX_CUSTOM_STORES = 25;
const storeSchema = object({ name: string({ min: 1, max: 80 }), url: string({ min: 1, max: 300 }), search: optional(string({ max: 300 }), undefined) });

export function shopRoutes({ shop, repos }) {
  const r = Router();
  r.use('/shop', requireUser);
  const heavy = rateLimit({ windowMs: 60_000, max: 20, key: (req) => req.user.id, message: 'You are browsing looks very fast. Give it a moment.' });

  r.get('/shop/retailers', (_req, res) =>
    res.json({ retailers: RETAILERS.map(({ id, name, tier, departments }) => ({ id, name, tier, departments })) })
  );

  // The store picker: the whole built-in database, the stores this person added, and where they shop.
  const publicCustom = (c) => ({ id: `${CUSTOM_PREFIX}${c.id}`, name: c.name, domain: c.domain, custom: true });
  r.get('/shop/stores', (req, res) => {
    const profile = repos.profiles.get(req.user.id);
    res.json({
      region: shopRegion(profile),
      regions: Object.entries(REGIONS).map(([code, name]) => ({ code, name })),
      stores: RETAILERS.map(({ id, name, tier, departments, regions, core }) => ({ id, name, tier, departments, regions, core })),
      custom: repos.customStores.list(req.user.id).map(publicCustom)
    });
  });
  const addLimit = rateLimit({ windowMs: 3_600_000, max: 60, key: (req) => req.user.id, message: 'You are adding stores very fast. Give it a moment.' });
  r.post('/shop/stores', addLimit, (req, res) => {
    const input = checkStoreInput(storeSchema(req.body));
    const existing = builtInFor(input.domain);
    if (existing) throw new HttpError(409, 'conflict', `${existing.name} is already in our list. Search for it and choose it there.`, undefined, { template: '{name} is already in our list. Search for it and choose it there.', vars: { name: existing.name } });
    if (repos.customStores.list(req.user.id).some((c) => c.domain === input.domain)) throw conflict('You have already added that store.');
    if (repos.customStores.count(req.user.id) >= MAX_CUSTOM_STORES) throw badRequest(`You can add up to ${MAX_CUSTOM_STORES} stores. Remove one to add another.`, undefined, { template: 'You can add up to {max} stores. Remove one to add another.', vars: { max: MAX_CUSTOM_STORES } });
    const row = repos.customStores.add(req.user.id, input);
    // a store you add is a store you want: choose it straight away
    const profile = repos.profiles.get(req.user.id);
    const stores = [...new Set([...(profile.style?.stores || []), `${CUSTOM_PREFIX}${row.id}`])];
    repos.profiles.save(req.user.id, { ...profile, style: { ...profile.style, stores } });
    res.status(201).json({ store: publicCustom(row), stores });
  });
  r.delete('/shop/stores/:id', (req, res) => {
    const n = Number(String(req.params.id).replace(CUSTOM_PREFIX, ''));
    if (!Number.isInteger(n) || !repos.customStores.remove(req.user.id, n)) throw notFound('That store was not found.');
    const profile = repos.profiles.get(req.user.id);
    const stores = (profile.style?.stores || []).filter((id) => id !== `${CUSTOM_PREFIX}${n}`);
    repos.profiles.save(req.user.id, { ...profile, style: { ...profile.style, stores } });
    res.json({ ok: true, stores });
  });
  r.post('/shop/looks', heavy, async (req, res) => res.json(await shop.looks(req.user, { ...looksSchema(req.body ?? {}), locale: req.locale })));
  r.post('/shop/gaps', heavy, async (req, res) => res.json(await shop.gaps(req.user, { ...gapsSchema(req.body ?? {}), locale: req.locale })));
  r.post('/shop/feedback', (req, res) => res.json(shop.feedback(req.user, feedbackSchema(req.body))));
  r.get('/shop/saved', (req, res) => res.json(shop.saved(req.user)));
  r.post('/shop/saved', (req, res) => res.status(201).json(shop.save(req.user, saveSchema(req.body).lookId)));
  r.delete('/shop/saved/:id', (req, res) => res.json(shop.unsave(req.user, req.params.id)));
  void SIGNALS;
  return r;
}
