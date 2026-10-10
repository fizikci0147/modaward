/**
 * Orchestrates outfit requests: loads the closet, forecast, wear history and learned taste,
 * runs the engine, enforces plan limits, and records wear and feedback.
 */
import { recommend, prepareGarments } from '../engine/outfit.js';
import { planWeek, weekDigest } from '../engine/planner.js';
import { packTrip } from '../engine/trip.js';
import { normalizePrefs } from '../engine/scoring.js';
import { TasteModel, withTaste } from '../ai/taste.js';
import { OCCASION_IDS } from '../shared/taxonomy.js';
import { entitlements } from './plans.js';
import { HttpError, badRequest, paymentRequired } from '../util/errors.js';
import { translatorFor } from '../i18n/index.js';
import { idleInfo } from '../shared/dormancy.js';

const needLocation = () => new HttpError(409, 'location_required', 'Set your location so we can check the weather.');

export function createOutfitService({ repos, weather, config, stylist = null }) {
  async function forecastFor(profile) {
    if (!profile.location) throw needLocation();
    const { lat, lon, name } = profile.location;
    return weather.forecast({ lat, lon, name });
  }

  function engineInputs(user, profile, today) {
    // idleDays lets the engine bring back pieces that have sat unworn for a long time
    const garments = repos.garments.list(user.id).map((g) => ({ ...g, idleDays: idleInfo(g, today).days }));
    const taste = new TasteModel(repos.profiles.getTaste(user.id));
    const prefs = withTaste(normalizePrefs(profile), taste);
    return {
      garments,
      prefs,
      history: repos.wear.history(user.id, today),
      blockedKeys: repos.feedback.blockedKeys(user.id),
      taste
    };
  }

  /** Attach full garment objects so the client can render without a second lookup. */
  const hydrate = (outfit, byId) => ({ ...outfit, items: outfit.itemIds.map((id) => byId.get(id)).filter(Boolean) });

  return {
    async forecast(user) {
      const profile = repos.profiles.get(user.id);
      const w = await forecastFor(profile);
      return { ...w, units: profile.units, locked: entitlements(user, config).planDays };
    },

    async forDay(user, { date, occasion, seed, count = 3, curate = true, excludeIds, featureId, locale = 'en' }) {
      const tr = translatorFor(locale);
      if (occasion !== undefined && !OCCASION_IDS.includes(occasion)) throw badRequest('Unknown occasion.');
      const profile = repos.profiles.get(user.id);
      const w = await forecastFor(profile);
      const target = date || w.today;
      // what the person said the day is for (an event they added) decides the occasion unless they pick one
      const plan = repos.plans.get(user.id, target);
      occasion = occasion ?? plan?.occasion ?? 'casual';
      const index = w.days.findIndex((d) => d.date === target);
      if (index < 0) throw badRequest('That date is outside the forecast window.');
      const ent = entitlements(user, config);
      if (index >= ent.planDays) throw paymentRequired('Planning beyond three days is a Pro feature.', { feature: 'plan' });

      const day = w.days[index];
      const input = engineInputs(user, profile, w.today);
      // pieces the person asked to leave out of today's suggestions
      if (excludeIds?.length) input.garments = input.garments.filter((g) => !excludeIds.includes(g.id));
      const result = recommend({
        garments: input.garments,
        day,
        occasion,
        prefs: input.prefs,
        history: input.history,
        blockedKeys: input.blockedKeys,
        seed,
        count,
        featureId,
        units: profile.units,
        nowHour: target === w.today ? w.nowHour : null,
        t: tr.t,
        locale
      });

      const byId = new Map(input.garments.map((g) => [g.id, g]));
      let outfits = result.outfits.map((o) => hydrate(o, byId));
      let stylistNote = null;
      if (curate && stylist && ent.aiStylist && outfits.length) {
        const curated = await stylist.curateDay({ user, profile, day: result.context, tips: result.tips, occasion, outfits, byId, locale }).catch(() => null);
        if (curated) {
          outfits = curated.outfits;
          stylistNote = curated.headline;
        }
      }
      return {
        date: target,
        occasion,
        plan,
        weather: { day, current: target === w.today ? w.current : null, location: w.location, stale: w.stale, units: profile.units },
        outfits,
        tips: result.tips,
        missing: result.missing,
        featureMissing: Boolean(result.featureMissing),
        stylistNote,
        worn: repos.wear.recent(user.id, 2).find((r) => r.date === target) ?? null
      };
    },

    async week(user, { seed, occasions, locale = 'en' } = {}) {
      const tr = translatorFor(locale);
      const profile = repos.profiles.get(user.id);
      const w = await forecastFor(profile);
      const ent = entitlements(user, config);
      const input = engineInputs(user, profile, w.today);
      const open = w.days.slice(0, ent.planDays);
      const plans = new Map(repos.plans.list(user.id, w.days[0].date, w.days[w.days.length - 1].date).map((p) => [p.date, p]));
      const planned = Object.fromEntries([...plans].map(([d, p]) => [d, p.occasion]));
      const plan = planWeek({
        garments: input.garments,
        days: open,
        profile,
        prefs: input.prefs,
        blockedKeys: input.blockedKeys,
        history: input.history,
        workDays: profile.workDays,
        occasions: { ...planned, ...occasions },
        units: profile.units,
        seed,
        nowHour: w.nowHour,
        count: 3,
        t: tr.t,
        locale
      });
      const byId = new Map(input.garments.map((g) => [g.id, g]));
      const days = w.days.map((d, i) => {
        if (i >= ent.planDays) return { date: d.date, locked: true, weather: d, plan: plans.get(d.date) ?? null };
        const p = plan[i];
        return { date: d.date, occasion: p.occasion, plan: plans.get(d.date) ?? null, weather: d, outfits: p.outfits.map((o) => hydrate(o, byId)), tips: p.tips, missing: p.missing, locked: false };
      });
      return { days, digest: weekDigest(w.days), units: profile.units, location: w.location, today: w.today, stale: w.stale };
    },

    /** A packing list for a trip, built from the closet and the destination's forecast. */
    async trip(user, { location, startOffset = 0, days, occasions, seed, locale = 'en' }) {
      const tr = translatorFor(locale);
      const profile = repos.profiles.get(user.id);
      const place = location ?? profile.location;
      if (!place) throw needLocation();
      const ent = entitlements(user, config);
      if (days > ent.planDays) throw paymentRequired(`Packing lists for trips longer than ${ent.planDays} days are a Pro feature.`, { feature: 'plan' }, { template: 'Packing lists for trips longer than {n} days are a Pro feature.', vars: { n: ent.planDays } });
      const w = await weather.forecast({ lat: place.lat, lon: place.lon, name: place.name });
      const tripDays = w.days.slice(startOffset, startOffset + days);
      if (!tripDays.length) throw badRequest('That date is outside the forecast window.');
      const start = tripDays[0].date;
      const input = engineInputs(user, profile, w.today);
      const result = packTrip({ garments: input.garments, days: tripDays, occasions, prefs: input.prefs, history: input.history, blockedKeys: input.blockedKeys, units: profile.units, seed: seed ?? 'trip', t: tr.t, locale });
      return { ...result, destination: { name: place.name, lat: place.lat, lon: place.lon }, start, requested: days, covered: tripDays.length, units: profile.units, location: w.location };
    },

    wear(user, { date, itemIds, occasion, key }) {
      const owned = repos.garments.ownedIds(user.id, itemIds);
      if (owned.length !== new Set(itemIds).size) throw badRequest('Some of those items are not in your closet.');
      const changed = repos.wear.log(user.id, { garmentIds: owned, date, outfitKey: key || [...owned].sort().join('|'), occasion });
      // logging the same outfit twice (a double tap) must not teach the taste model twice
      if (changed) this.feedback(user, { itemIds: owned, signal: 'wear', key });
      return { ok: true };
    },

    unwear: (user, date) => ({ removed: repos.wear.unlog(user.id, date) }),

    feedback(user, { itemIds, signal, key }) {
      const owned = repos.garments.ownedIds(user.id, itemIds);
      if (!owned.length) throw badRequest('Those items are not in your closet.');
      const items = prepareGarments(repos.garments.list(user.id, { includeArchived: true }).filter((g) => owned.includes(g.id)));
      const model = new TasteModel(repos.profiles.getTaste(user.id));
      model.learn(items, signal);
      repos.profiles.saveTaste(user.id, model.toJSON());
      const outfitKey = key || [...owned].sort().join('|');
      repos.feedback.add(user.id, 'outfit', outfitKey, signal);
      return { ok: true, learned: model.n };
    }
  };
}
