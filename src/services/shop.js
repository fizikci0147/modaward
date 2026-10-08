/**
 * Shopping service: personalised looks, closet gaps, feedback that trains the taste model,
 * and the saved-looks wishlist. Free accounts see a handful of looks; Pro sees the full feed.
 */
import { translatorFor } from '../i18n/index.js';
import { buildLooks } from '../shop/looks.js';
import { gapSuggestions } from '../shop/gaps.js';
import { TasteModel } from '../ai/taste.js';
import { TYPES, withDefaults } from '../shared/taxonomy.js';
import { entitlements } from './plans.js';
import { HttpError, badRequest, notFound, paymentRequired } from '../util/errors.js';
import { colorName } from '../shared/color.js';
import { hashString } from '../engine/rng.js';

const forecastNeeded = () => new HttpError(409, 'location_required', 'Set your location so we can tailor looks to the weather.');

/** Rebuild taste-model features from a stored look piece (never trusting client-sent data). */
function pieceAsItem(piece) {
  const def = TYPES[piece.type];
  if (!def) return null;
  return withDefaults({ type: piece.type, color: piece.color, colorName: piece.colorName ?? colorName(piece.color), pattern: piece.pattern ?? 'solid', brand: piece.retailer?.id });
}

export function createShopService({ repos, weather, catalog, linker, config, stylist = null }) {
  async function days(profile) {
    if (!profile.location) throw forecastNeeded();
    const { lat, lon, name } = profile.location;
    const w = await weather.forecast({ lat, lon, name });
    return w.days;
  }

  // Building looks is CPU-bound (~1s of synchronous work), so identical requests are answered from
  // a short-lived cache. The key covers everything that changes the result.
  const memo = new Map();
  const stats = { computed: 0 };

  return {
    stats,
    async looks(user, { kind = 'both', storeMode, occasions, seed, limit = 18, curate = true, locale = 'en' } = {}) {
      const tr = translatorFor(locale);
      const profile = repos.profiles.get(user.id);
      const ent = entitlements(user, config);
      const forecast = await days(profile);
      const cap = ent.shopLooks;
      const wardrobe = repos.garments.list(user.id);
      const taste = repos.profiles.getTaste(user.id);
      const blocked = repos.feedback.blockedLooks(user.id);
      const memoKey = hashString(JSON.stringify([user.id, locale, kind, storeMode, occasions, seed, limit, curate, ent.plan, forecast[0].date, profile, wardrobe.map((g) => [g.id, g.updatedAt, g.favorite]), taste.n, blocked.size])).toString(36);
      const hit = memo.get(memoKey);
      if (hit && Date.now() - hit.at < 120_000) return hit.value;
      stats.computed += 1;
      const built = buildLooks({
        profile,
        wardrobe,
        days: forecast,
        catalog,
        linker,
        tasteState: taste,
        kind,
        storeMode,
        occasions,
        seed,
        // build a full feed even for free users so the number locked is honest
        limit: Math.max(limit, cap),
        blocked,
        t: tr.t,
        locale
      });
      let looks = built.looks;
      let note = null;
      if (curate && stylist && ent.aiStylist) {
        const curated = await stylist.curateLooks({ user, profile, looks, reference: built.reference, locale }).catch(() => null);
        if (curated) {
          looks = curated.looks;
          note = curated.headline;
        }
      }
      const total = looks.length;
      const visible = looks.slice(0, Math.min(limit, cap));
      for (const l of visible) repos.looks.remember(user.id, l.id, l);
      const value = { looks: visible, locked: Math.max(0, total - visible.length), reference: built.reference, occasions: built.occasions, storeMode: built.storeMode, usingProducts: built.usingProducts, stylistNote: note, plan: ent.plan };
      memo.set(memoKey, { at: Date.now(), value });
      if (memo.size > 300) memo.delete(memo.keys().next().value);
      return value;
    },

    async gaps(user, { storeMode, locale = 'en' } = {}) {
      const tr = translatorFor(locale);
      const profile = repos.profiles.get(user.id);
      const forecast = await days(profile);
      return { gaps: gapSuggestions({ wardrobe: repos.garments.list(user.id), profile, days: forecast, catalog, linker, storeMode, t: tr.t, tn: tr.tn }) };
    },

    feedback(user, { lookId, signal, pieceIndex }) {
      const look = repos.looks.get(user.id, lookId);
      if (!look) throw notFound('That look has expired. Refresh to see new ones.');
      let items;
      if (pieceIndex !== undefined) {
        const piece = look.pieces[pieceIndex];
        if (!piece || piece.source === 'owned') throw badRequest('Choose one of the new pieces.');
        items = [pieceAsItem(piece)];
      } else {
        items = look.pieces.map(pieceAsItem).filter(Boolean);
      }
      const model = new TasteModel(repos.profiles.getTaste(user.id));
      model.learn(items, signal);
      repos.profiles.saveTaste(user.id, model.toJSON());
      // piece-level feedback teaches taste but only a whole-look dislike hides the look
      repos.feedback.add(user.id, 'look', pieceIndex === undefined ? look.key : `${look.key}#${pieceIndex}`, signal);
      return { ok: true, learned: model.n };
    },

    save(user, lookId) {
      const look = repos.looks.get(user.id, lookId);
      if (!look) throw notFound('That look has expired. Refresh to see new ones.');
      const ent = entitlements(user, config);
      if (ent.savedLooks !== null && repos.saved.count(user.id) >= ent.savedLooks) {
        throw paymentRequired(`The free plan saves ${ent.savedLooks} looks. Upgrade to Pro for unlimited saves.`, { feature: 'saved', limit: ent.savedLooks }, { template: 'The free plan saves {n} looks. Upgrade to Pro for unlimited saves.', vars: { n: ent.savedLooks } });
      }
      const id = repos.saved.add(user.id, 'look', look);
      this.feedback(user, { lookId, signal: 'save' });
      return { id };
    },

    saved: (user) => ({ saved: repos.saved.list(user.id) }),
    unsave: (user, id) => {
      if (!repos.saved.remove(user.id, id)) throw notFound('That saved look was not found.');
      return { ok: true };
    }
  };
}
