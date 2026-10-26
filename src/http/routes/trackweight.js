import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, string, optional } from '../../util/validate.js';
import { entitlements } from '../../services/plans.js';
import { notFound, unavailable, paymentRequired, unauthorized, forbidden } from '../../util/errors.js';

const analyzeSchema = object({ image: string({ min: 20, max: 5_000_000, trim: false }), hint: optional(string({ max: 300 })) });

/**
 * API behind the calorie tracker page (/trackweight). Everything here is for members (see
 * services/trackweight-access.js); the person's diary lives on their own device. Reading a meal from
 * a photo costs money per call, so it also follows the rule of the other AI features: switched on for
 * the site (FREE_AI, or Pro on a paid site) and metered per person and per day.
 */
export function trackweightRoutes({ foods, meals, config, trackweightAccess }) {
  const r = Router();
  r.use('/trackweight', (req, _res, next) => {
    const state = trackweightAccess.state(req.user);
    if (state === 'signin') return next(unauthorized());
    if (state === 'pending') return next(forbidden('Track Weight is for approved members.'));
    next();
  });
  const lookups = rateLimit({ windowMs: 60_000, max: 60, message: 'Too many searches. Please slow down.' });
  const photos = rateLimit({ windowMs: 60_000, max: 10, key: (req) => req.user?.id ?? req.ip });

  r.get('/trackweight/status', (req, res) => {
    const allowed = Boolean(meals) && entitlements(req.user, config).photoTagging;
    res.json({
      access: trackweightAccess.mode,
      signedIn: Boolean(req.user),
      usda: foods.usda,
      // why photos are (not) available, so the page can say the right thing
      photo: !meals ? 'off' : !allowed ? (config.plans.pricing === 'paid' ? 'pro' : 'off') : req.user ? 'on' : 'signin'
    });
  });

  r.get('/trackweight/foods/search', lookups, async (req, res) => {
    const found = await foods.search(req.query.q);
    if (found === null) throw unavailable('The food databases are not reachable right now. Your own foods and the built-in library still work.');
    res.json({ foods: found });
  });

  r.get('/trackweight/foods/barcode/:code', lookups, async (req, res) => {
    const food = await foods.barcode(req.params.code);
    if (food === undefined) throw unavailable('The food database is not reachable right now.');
    if (!food) throw notFound('That product is not in the food database yet. You can add it by hand.');
    res.json({ food });
  });

  r.post('/trackweight/analyze-meal', requireUser, photos, async (req, res) => {
    if (!meals) throw unavailable('Photo estimates are not switched on for this site.');
    if (!entitlements(req.user, config).photoTagging) {
      throw config.plans.pricing === 'paid' ? paymentRequired('Photo estimates are a Pro feature.', { feature: 'pro' }) : unavailable('Photo estimates are not switched on for this site.');
    }
    const body = analyzeSchema(req.body);
    res.json(await meals.analyze({ user: req.user, imageDataUrl: body.image, hint: body.hint }));
  });

  return r;
}
