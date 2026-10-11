import { paymentRequired, conflict } from '../util/errors.js';

/**
 * Entitlements. Free is generous enough to fall in love with the app (full daily outfits, the
 * taste model, 3 days of planning); Pro removes the limits and adds the AI stylist and the
 * full shopping experience. Every limit is enforced here, on the server.
 */
export function entitlements(user, config) {
  if (config.plans.pricing === 'free') {
    // the free version: no limits and nothing to buy. AI features only if the operator pays for them (FREE_AI).
    return { plan: 'free', pricing: 'free', closetLimit: null, planDays: 8, shopLooks: 36, aiStylist: config.plans.freeAi, photoTagging: config.plans.freeAi, savedLooks: null };
  }
  const pro = user?.plan === 'pro';
  return {
    pricing: 'paid',
    plan: pro ? 'pro' : 'free',
    closetLimit: pro ? null : config.plans.freeClosetLimit,
    planDays: pro ? 8 : 3, // Pro sees the whole forecast window (today + 7)
    shopLooks: pro ? 36 : config.plans.freeLooksPerWeek,
    aiStylist: pro,
    photoTagging: pro,
    savedLooks: pro ? null : 10
  };
}

/** Every row counts, archived or not, so archiving cannot be used to dodge the closet limit. */
export const hardGarmentCap = (user, config) => (config?.plans?.pricing === 'free' ? 500 : user?.plan === 'pro' ? 2000 : 100);

export function assertWithinStorageCap(user, totalNow, adding = 1, config) {
  if (totalNow + adding > hardGarmentCap(user, config)) throw conflict('Your closet has reached its storage limit. Delete some pieces and try again.');
}

export function assertCanAddGarments(user, config, currentCount, adding = 1) {
  const { closetLimit } = entitlements(user, config);
  if (closetLimit !== null && currentCount + adding > closetLimit) {
    throw paymentRequired(`The free plan holds ${closetLimit} items. Upgrade to Pro for an unlimited closet.`, { feature: 'closet', limit: closetLimit }, { template: 'The free plan holds {n} items. Upgrade to Pro for an unlimited closet.', vars: { n: closetLimit } });
  }
}
