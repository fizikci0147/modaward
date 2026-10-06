import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, oneOf, optional, string } from '../../util/validate.js';
import { baseUrl } from '../base-url.js';
import { unavailable } from '../../util/errors.js';

const checkoutSchema = object({ interval: optional(oneOf(['month', 'year']), 'year') });

export function billingRoutes({ billing, config, codes }) {
  const r = Router();
  r.use('/billing', requireUser);
  const limit = rateLimit({ windowMs: 60_000, max: 10, key: (req) => req.user.id });
  r.post('/billing/checkout', limit, async (req, res) => {
    if (!billing) throw unavailable('Online payments are not switched on for this site yet.');
    res.json(await billing.checkout(req.user, checkoutSchema(req.body ?? {}).interval, baseUrl(config, req)));
  });
  r.post('/billing/portal', limit, async (req, res) => {
    if (!billing) throw unavailable('Online payments are not switched on for this site yet.');
    res.json(await billing.portal(req.user, baseUrl(config, req)));
  });
  // comped access works even when Stripe is not configured
  const redeemLimit = rateLimit({ windowMs: 600_000, max: 10, key: (req) => req.user.id });
  r.post('/billing/redeem', redeemLimit, (req, res) => {
    const { code } = object({ code: string({ min: 1, max: 40 }) })(req.body ?? {});
    res.json(codes.redeem(req.user, code));
  });
  return r;
}
