import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, string, arrayOf } from '../../util/validate.js';
import { MAX_TAG_BATCH } from '../../ai/stylist.js';
import { entitlements } from '../../services/plans.js';
import { paymentRequired, unavailable } from '../../util/errors.js';

const schema = object({ image: string({ min: 20, max: 5_000_000, trim: false }) });
// bulk tagging sends small thumbnails, so a batch stays far below the request size limit
const batchSchema = object({ images: arrayOf(string({ min: 20, max: 700_000, trim: false }), { min: 1, max: MAX_TAG_BATCH }) });

export function aiRoutes({ stylist, config }) {
  const r = Router();
  r.use('/ai', requireUser);
  const limit = rateLimit({ windowMs: 60_000, max: 10, key: (req) => req.user.id });
  r.post('/ai/analyze-garment', limit, async (req, res) => {
    if (!entitlements(req.user, config).photoTagging) throw paymentRequired('Auto-fill from a photo is a Pro feature.', { feature: 'pro' });
    if (!stylist) throw unavailable('Auto-fill is not switched on for this site.');
    res.json({ suggestion: await stylist.analyzeGarment({ user: req.user, imageDataUrl: schema(req.body).image }) });
  });
  r.post('/ai/analyze-garments', limit, async (req, res) => {
    if (!entitlements(req.user, config).photoTagging) throw paymentRequired('Auto-fill from a photo is a Pro feature.', { feature: 'pro' });
    if (!stylist) throw unavailable('Auto-fill is not switched on for this site.');
    const { images } = batchSchema(req.body);
    res.json({ suggestions: await stylist.analyzeGarments({ user: req.user, imageDataUrls: images }) });
  });
  return r;
}
