import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, string } from '../../util/validate.js';
import { entitlements } from '../../services/plans.js';
import { paymentRequired, unavailable } from '../../util/errors.js';

const schema = object({ image: string({ min: 20, max: 5_000_000, trim: false }) });

export function photoRoutes({ config, cutoutService }) {
  const r = Router();
  r.use('/photos', requireUser);
  const limit = rateLimit({ windowMs: 60_000, max: 12, key: (req) => req.user.id });
  r.post('/photos/cutout', limit, async (req, res) => {
    if (!entitlements(req.user, config).photoTagging) throw paymentRequired('High-accuracy background removal is a Pro feature.', { feature: 'pro' });
    if (!cutoutService) throw unavailable('High-accuracy background removal is not switched on for this site.');
    res.json({ image: await cutoutService.remove(req.user, schema(req.body).image) });
  });
  return r;
}
