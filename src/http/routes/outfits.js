import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, string, integer, oneOf, optional, arrayOf, boolean } from '../../util/validate.js';
import { OCCASION_IDS } from '../../shared/taxonomy.js';
import { SIGNALS } from '../../ai/taste.js';

const date = () => string({ pattern: /^\d{4}-\d{2}-\d{2}$/, patternMessage: 'must be a date like 2026-10-06', max: 10 });
const ids = () => arrayOf(string({ min: 36, max: 36 }), { min: 1, max: 12, unique: true });

const recommendSchema = object({
  date: optional(date(), undefined),
  occasion: optional(oneOf(OCCASION_IDS), 'casual'),
  seed: optional(string({ max: 40 }), undefined),
  count: optional(integer({ min: 1, max: 5 }), 3),
  curate: optional(boolean(), true),
  excludeIds: optional(arrayOf(string({ min: 36, max: 36 }), { min: 1, max: 20, unique: true }), undefined)
});
const wearSchema = object({ date: date(), itemIds: ids(), occasion: optional(oneOf(OCCASION_IDS), undefined), key: optional(string({ max: 600 }), undefined) });
const feedbackSchema = object({ itemIds: ids(), signal: oneOf(Object.keys(SIGNALS)), key: optional(string({ max: 600 }), undefined) });
const weekSchema = object({ seed: optional(string({ max: 40 }), undefined) });

export function outfitRoutes({ outfits, repos }) {
  const r = Router();
  r.use(['/weather', '/outfits', '/plan'], requireUser);
  const heavy = rateLimit({ windowMs: 60_000, max: 40, key: (req) => req.user.id, message: 'You are asking for outfits very quickly. Take a breath and try again.' });

  r.get('/weather', async (req, res) => res.json(await outfits.forecast(req.user)));
  r.post('/outfits/recommend', heavy, async (req, res) => res.json(await outfits.forDay(req.user, recommendSchema(req.body))));
  r.post('/plan', heavy, async (req, res) => res.json(await outfits.week(req.user, weekSchema(req.body ?? {}))));
  r.post('/outfits/wear', (req, res) => res.json(outfits.wear(req.user, wearSchema(req.body))));
  r.delete('/outfits/wear', (req, res) => res.json(outfits.unwear(req.user, date()(req.query.date, 'date'))));
  r.post('/outfits/feedback', (req, res) => res.json(outfits.feedback(req.user, feedbackSchema(req.body))));
  r.get('/outfits/history', (req, res) => res.json({ history: repos.wear.recent(req.user.id, 30) }));
  return r;
}
