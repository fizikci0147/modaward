import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, string } from '../../util/validate.js';
import { entitlements } from '../../services/plans.js';
import { paymentRequired, unavailable } from '../../util/errors.js';

const schema = object({ image: string({ min: 20, max: 5_000_000, trim: false }) });

export function aiRoutes({ stylist, config }) {
  const r = Router();
  r.use('/ai', requireUser);
  const limit = rateLimit({ windowMs: 60_000, max: 10, key: (req) => req.user.id });
  r.post('/ai/analyze-garment', limit, async (req, res) => {
    if (!entitlements(req.user, config).photoTagging) throw paymentRequired('Auto-fill from a photo is a Pro feature.', { feature: 'pro' });
    if (!stylist) throw unavailable('Auto-fill is not switched on for this site.');
    res.json({ suggestion: await stylist.analyzeGarment({ user: req.user, imageDataUrl: schema(req.body).image }) });
  });
  return r;
}
