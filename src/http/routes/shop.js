import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, string, integer, oneOf, optional, arrayOf } from '../../util/validate.js';
import { OCCASION_IDS } from '../../shared/taxonomy.js';
import { SIGNALS } from '../../ai/taste.js';
import { RETAILERS } from '../../shop/retailers.js';

const looksSchema = object({
  kind: optional(oneOf(['both', 'new', 'owned']), 'both'),
  storeMode: optional(oneOf(['mix', 'single']), undefined),
  occasions: optional(arrayOf(oneOf(OCCASION_IDS), { max: 5, unique: true }), undefined),
  seed: optional(string({ max: 40 }), undefined),
  limit: optional(integer({ min: 1, max: 36 }), 18)
});
const gapsSchema = object({ storeMode: optional(oneOf(['mix', 'single']), undefined) });
const feedbackSchema = object({
  lookId: string({ min: 3, max: 40 }),
  signal: oneOf(['love', 'like', 'dislike', 'skip']),
  pieceIndex: optional(integer({ min: 0, max: 9 }), undefined)
});
const saveSchema = object({ lookId: string({ min: 3, max: 40 }) });

export function shopRoutes({ shop }) {
  const r = Router();
  r.use('/shop', requireUser);
  const heavy = rateLimit({ windowMs: 60_000, max: 30, key: (req) => req.user.id, message: 'You are browsing looks very fast. Give it a moment.' });

  r.get('/shop/retailers', (_req, res) =>
    res.json({ retailers: RETAILERS.map(({ id, name, tier, departments }) => ({ id, name, tier, departments })) })
  );
  r.post('/shop/looks', heavy, async (req, res) => res.json(await shop.looks(req.user, looksSchema(req.body ?? {}))));
  r.post('/shop/gaps', heavy, async (req, res) => res.json(await shop.gaps(req.user, gapsSchema(req.body ?? {}))));
  r.post('/shop/feedback', (req, res) => res.json(shop.feedback(req.user, feedbackSchema(req.body))));
  r.get('/shop/saved', (req, res) => res.json(shop.saved(req.user)));
  r.post('/shop/saved', (req, res) => res.status(201).json(shop.save(req.user, saveSchema(req.body).lookId)));
  r.delete('/shop/saved/:id', (req, res) => res.json(shop.unsave(req.user, req.params.id)));
  void SIGNALS;
  return r;
}
