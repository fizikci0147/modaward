/**
 * Packing list for a trip: choose an outfit for every day (and occasion) so that the whole trip
 * needs as few pieces as possible. Each day's outfit comes from the normal engine, so it is right
 * for that day's weather; the choice among candidates favours outfits that reuse what is already
 * going in the bag, and caps shoes and outer layers (the bulky items) at two each.
 */
import { recommend, prepareGarments } from './outfit.js';
import { weekDigest } from './planner.js';

const MAX_SHOES = 2;
const MAX_OUTER = 2;

const hardness = (day) => Math.abs((day.tMaxC + day.tMinC) / 2 - 18) + (day.precipProb ?? 0) / 20;

/**
 * @param {object} args
 * @param {object[]} args.garments   stored garments
 * @param {object[]} args.days       forecast days of the trip, in order
 * @param {string[]} args.occasions  one outfit per day for each of these
 */
export function packTrip({ garments, days, occasions, prefs, history, blockedKeys, pairBlocks, units, seed, t, locale }) {
  const prepared = prepareGarments(garments);
  const byId = new Map(prepared.map((g) => [g.id, g]));
  const slots = [];
  days.forEach((day, index) => occasions.forEach((occasion) => slots.push({ day, index, occasion })));
  slots.sort((a, b) => hardness(b.day) - hardness(a.day));

  const bag = new Map(); // id → dates it is worn
  const inBag = (cat) => [...bag.keys()].filter((id) => byId.get(id)?.category === cat);
  const chosen = new Map(); // `${index}|${occasion}` → outfit
  const missing = [];

  for (const slot of slots) {
    const result = recommend({ garments, day: slot.day, occasion: slot.occasion, prefs, history, blockedKeys, pairBlocks, seed, count: 6, units, nowHour: null, t, locale });
    const candidates = result.outfits;
    if (!candidates.length) {
      missing.push({ date: slot.day.date, occasion: slot.occasion, reason: result.missing });
      continue;
    }
    // bulky pieces are capped: prefer candidates that stay within the limit, and only break it
    // when nothing else suits the day's weather
    const overCap = (o) => {
      const shoes = o.itemIds.find((id) => byId.get(id)?.category === 'shoes');
      const outer = o.itemIds.find((id) => byId.get(id)?.category === 'outerwear');
      return (shoes && !bag.has(shoes) && inBag('shoes').length >= MAX_SHOES) || (outer && !bag.has(outer) && inBag('outerwear').length >= MAX_OUTER);
    };
    const within = candidates.filter((o) => !overCap(o));
    const pool = within.length ? within : candidates;
    let best = null;
    let bestScore = -Infinity;
    for (const o of pool) {
      const main = o.itemIds.filter((id) => byId.get(id)?.category !== 'accessory');
      const reused = main.filter((id) => bag.has(id)).length;
      const fresh = o.itemIds.filter((id) => !bag.has(id)).length;
      const score = o.score / 100 + 0.5 * (main.length ? reused / main.length : 0) - 0.05 * fresh;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    chosen.set(`${slot.index}|${slot.occasion}`, best);
    for (const id of best.itemIds) {
      if (!bag.has(id)) bag.set(id, []);
      bag.get(id).push(slot.day.date);
    }
  }

  const hydrate = (o) => ({ ...o, items: o.itemIds.map((id) => byId.get(id)).filter(Boolean) });
  const plan = [];
  days.forEach((day, index) => {
    for (const occasion of occasions) {
      const o = chosen.get(`${index}|${occasion}`);
      if (o) plan.push({ date: day.date, occasion, weather: day, outfit: hydrate(o) });
    }
  });

  const ORDER = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];
  const pack = [...bag.entries()]
    .map(([id, dates]) => ({ item: byId.get(id), usedOn: [...new Set(dates)].sort() }))
    .filter((p) => p.item)
    .sort((a, b) => ORDER.indexOf(a.item.category) - ORDER.indexOf(b.item.category) || b.usedOn.length - a.usedOn.length);

  const outfitCount = plan.length;
  const worn = pack.reduce((n, p) => n + p.usedOn.length, 0);
  return {
    plan,
    pack,
    missing,
    pieces: pack.length,
    outfits: outfitCount,
    avgWears: pack.length ? Math.round((worn / pack.length) * 10) / 10 : 0,
    digest: weekDigest(days)
  };
}
