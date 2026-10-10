import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, string, integer, number, oneOf, optional, arrayOf, boolean } from '../../util/validate.js';
import { OCCASION_IDS } from '../../shared/taxonomy.js';
import { SIGNALS } from '../../ai/taste.js';
import { daysBetween } from '../../shared/dormancy.js';
import { badRequest } from '../../util/errors.js';
import { assertPlausibleDate } from '../../util/wear-date.js';

const date = () => string({ pattern: /^\d{4}-\d{2}-\d{2}$/, patternMessage: 'must be a date like 2026-10-06', max: 10 });
const ids = () => arrayOf(string({ min: 36, max: 36 }), { min: 1, max: 12, unique: true });

const recommendSchema = object({
  date: optional(date(), undefined),
  occasion: optional(oneOf(OCCASION_IDS), undefined),
  seed: optional(string({ max: 40 }), undefined),
  count: optional(integer({ min: 1, max: 5 }), 3),
  curate: optional(boolean(), true),
  excludeIds: optional(arrayOf(string({ min: 36, max: 36 }), { min: 1, max: 20, unique: true }), undefined),
  featureId: optional(string({ min: 36, max: 36 }), undefined)
});
const wearSchema = object({ date: date(), itemIds: ids(), occasion: optional(oneOf(OCCASION_IDS), undefined), key: optional(string({ max: 600 }), undefined) });
const pairSchema = object({ pieceId: string({ min: 36, max: 36 }), withIds: ids() });
const tripSchema = object({
  location: optional(object({ name: string({ min: 1, max: 80 }), lat: number({ min: -90, max: 90 }), lon: number({ min: -180, max: 180 }) }), undefined),
  startOffset: optional(integer({ min: 0, max: 7 }), 0),
  days: integer({ min: 1, max: 8 }),
  occasions: arrayOf(oneOf(OCCASION_IDS), { min: 1, max: 3, unique: true }),
  seed: optional(string({ max: 40 }), undefined)
});
const feedbackSchema = object({ itemIds: ids(), signal: oneOf(Object.keys(SIGNALS)), key: optional(string({ max: 600 }), undefined) });
const weekSchema = object({ seed: optional(string({ max: 40 }), undefined) });

export function outfitRoutes({ outfits, repos }) {
  const r = Router();
  r.use(['/weather', '/outfits', '/plan', '/plans', '/trips'], requireUser);
  const heavy = rateLimit({ windowMs: 60_000, max: 40, key: (req) => req.user.id, message: 'You are asking for outfits very quickly. Take a breath and try again.' });

  r.get('/weather', async (req, res) => res.json(await outfits.forecast(req.user)));
  r.post('/outfits/recommend', heavy, async (req, res) => res.json(await outfits.forDay(req.user, { ...recommendSchema(req.body), locale: req.locale })));
  r.post('/plan', heavy, async (req, res) => res.json(await outfits.week(req.user, { ...weekSchema(req.body ?? {}), locale: req.locale })));
  // every distinct destination is a forecast request to the weather provider, so keep this tighter
  const tripLimit = rateLimit({ windowMs: 60_000, max: 8, key: (req) => req.user.id, message: 'You are asking for outfits very quickly. Take a breath and try again.' });
  r.post('/trips/plan', tripLimit, async (req, res) => res.json(await outfits.trip(req.user, { ...tripSchema(req.body), locale: req.locale })));
  // "this piece does not go with the rest of this look": remembered for good, for that combination only
  r.post('/outfits/pair-block', (req, res) => {
    const { pieceId, withIds } = pairSchema(req.body);
    repos.pairs.add(req.user.id, pieceId, withIds);
    res.json({ ok: true, pairs: repos.pairs.count(req.user.id) });
  });
  r.post('/outfits/pair-unblock', (req, res) => {
    const { pieceId, withIds } = pairSchema(req.body);
    repos.pairs.remove(req.user.id, pieceId, withIds);
    res.json({ ok: true, pairs: repos.pairs.count(req.user.id) });
  });

  r.post('/outfits/wear', (req, res) => {
    const input = wearSchema(req.body);
    assertPlausibleDate(input.date);
    res.json(outfits.wear(req.user, input));
  });
  r.delete('/outfits/wear', (req, res) => {
    const when = date()(req.query.date, 'date');
    assertPlausibleDate(when);
    res.json(outfits.unwear(req.user, when));
  });
  r.post('/outfits/feedback', (req, res) => res.json(outfits.feedback(req.user, feedbackSchema(req.body))));
  // what each day is for (a dinner, a wedding, a day at the office): it decides the occasion
  const dayParam = (v) => {
    const d = date()(v, 'date');
    const ago = daysBetween(d, new Date().toISOString().slice(0, 10));
    if (Number.isNaN(ago) || ago > 7 || ago < -120) throw badRequest('That date is out of range.');
    return d;
  };
  const planSchema = object({ occasion: oneOf(OCCASION_IDS), note: optional(string({ max: 60 }), '') });
  r.get('/plans', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    res.json({ plans: repos.plans.list(req.user.id, date()(req.query.from || today, 'from'), date()(req.query.to || '2999-12-31', 'to')) });
  });
  r.put('/plans/:date', (req, res) => {
    const day = dayParam(req.params.date);
    const body = planSchema(req.body);
    repos.plans.set(req.user.id, day, { occasion: body.occasion, note: body.note.replace(/[<>]/g, '') });
    res.json({ plan: repos.plans.get(req.user.id, day) });
  });
  r.delete('/plans/:date', (req, res) => {
    repos.plans.remove(req.user.id, dayParam(req.params.date));
    res.json({ ok: true });
  });

  r.get('/outfits/history', (req, res) => res.json({ history: repos.wear.recent(req.user.id, 30) }));
  return r;
}
