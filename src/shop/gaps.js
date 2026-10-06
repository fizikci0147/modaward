/**
 * "What is your closet missing?" — an explainable, rule-based review that looks at the closet
 * against the actual forecast and the person's occasions, then proposes specific pieces that
 * harmonise with what they already own.
 */
import { buildContext } from '../engine/context.js';
import { prepareGarments } from '../engine/outfit.js';
import { harmony, colorRole } from '../shared/color.js';
import { TYPES } from '../shared/taxonomy.js';
import { specsForType } from './specs.js';
import { allowedBy, queryFor } from './pool.js';
import { assignRetailers } from './assign.js';
import { pieceCard, shopOccasions, BUDGET_KEY } from './looks.js';
import { withDefaults } from '../shared/taxonomy.js';
import { hashString } from '../engine/rng.js';

const has = (garments, pred) => garments.filter(pred);

/** Colours from the style library that best harmonise with what is already owned. */
function bestColors(typeId, wardrobe, profile, count = 2) {
  const allowed = allowedBy(profile);
  const liked = profile.style?.likedColors || [];
  const complement = { top: ['bottom'], bottom: ['top'], outerwear: ['top', 'bottom'], shoes: ['top', 'bottom'], dress: [], accessory: ['top', 'outerwear'] }[TYPES[typeId].category];
  const partners = wardrobe.filter((g) => complement.includes(g.category));
  const seen = new Set();
  const scored = [];
  for (const spec of specsForType(typeId, liked)) {
    if (seen.has(spec.colorName)) continue;
    seen.add(spec.colorName);
    const piece = withDefaults({ id: spec.id, name: `${spec.colorName} ${spec.descriptor}`, type: typeId, color: spec.color, pattern: 'solid', styles: [spec.style] });
    piece.colorName = spec.colorName;
    piece.descriptor = spec.descriptor;
    piece.source = 'spec';
    if (!allowed(piece)) continue;
    let fit = 0.7;
    if (partners.length) fit = partners.reduce((s, p) => s + harmony([{ hex: spec.color }, { hex: p.color }]).score, 0) / partners.length;
    scored.push({ piece, score: fit + (liked.includes(spec.colorName) ? 0.12 : 0) + (colorRole(spec.color) === 'neutral' ? 0.08 : 0) + (profile.style?.archetypes?.[spec.style] ?? 0.4) * 0.1, partners: partners.filter((p) => harmony([{ hex: spec.color }, { hex: p.color }]).score >= 0.8).length });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}

/** @returns {{id:string,title:string,why:string,severity:'high'|'medium'|'low',typeIds:string[]}[]} */
export function findGaps({ wardrobe, profile, days }) {
  const g = prepareGarments(wardrobe);
  const ctxs = days.slice(0, 7).map((d) => buildContext(d));
  const wet = ctxs.filter((c) => c.rain !== 'none').length;
  const snow = ctxs.some((c) => c.snow);
  const coldest = Math.min(...ctxs.map((c) => c.minFeels));
  const hottest = Math.max(...ctxs.map((c) => c.maxFeels));
  const uv = Math.max(...ctxs.map((c) => c.maxUv));
  const occasions = new Set(shopOccasions(profile));
  const gaps = [];
  const add = (gap) => gaps.push(gap);

  const outer = has(g, (x) => x.category === 'outerwear');
  const shoes = has(g, (x) => x.category === 'shoes');
  const bottoms = has(g, (x) => x.category === 'bottom');
  const tops = has(g, (x) => x.category === 'top');

  if (wet >= 1 && !outer.some((x) => x.waterproof)) {
    add({ id: 'rain-jacket', title: 'A rain jacket', why: `${wet} wet ${wet === 1 ? 'day' : 'days'} in the next ${ctxs.length}, and nothing in your closet keeps you dry.`, severity: wet >= 2 ? 'high' : 'medium', typeIds: ['raincoat', 'trench'] });
  }
  if ((wet >= 1 || snow) && !shoes.some((x) => x.waterproof)) {
    add({ id: 'wet-shoes', title: 'Waterproof shoes', why: snow ? 'Snow is in the forecast and none of your shoes can handle it.' : 'Wet days are coming and none of your shoes are weatherproof.', severity: snow || wet >= 2 ? 'high' : 'medium', typeIds: ['waterproofboots', 'rainboots'] });
  }
  if (coldest < 6 && !outer.some((x) => x.warmth >= 4)) {
    add({ id: 'warm-coat', title: 'A warm coat', why: `It drops to ${Math.round(coldest)}°C and your warmest outer layer is not built for that.`, severity: coldest < 0 ? 'high' : 'medium', typeIds: ['wool-coat', 'puffer'] });
  }
  if (coldest < 3 && !g.some((x) => x.category === 'accessory' && ['scarf', 'beanie', 'gloves'].includes(x.type))) {
    add({ id: 'cold-accessories', title: 'Scarf and beanie', why: 'Cold snaps are easier with the right accessories.', severity: 'low', typeIds: ['scarf', 'beanie'] });
  }
  if (coldest < 14 && !tops.some((x) => ['sweater', 'cardigan'].includes(x.type))) {
    add({ id: 'knit-layer', title: 'A layering knit', why: 'Cool days call for a sweater or cardigan, and you have neither.', severity: 'medium', typeIds: ['sweater', 'cardigan'] });
  }
  if (hottest > 27 && tops.filter((x) => x.warmth <= 1).length < 3) {
    add({ id: 'light-tops', title: 'Breathable summer tops', why: `Highs reach ${Math.round(hottest)}°C and you have fewer than three light tops.`, severity: 'medium', typeIds: ['tee', 'polo'] });
  }
  if (uv >= 7 && !g.some((x) => x.type === 'sunglasses')) {
    add({ id: 'sunglasses', title: 'Sunglasses', why: `UV index reaches ${Math.round(uv)} this week.`, severity: 'low', typeIds: ['sunglasses'] });
  }
  if ((occasions.has('work') || occasions.has('formal')) && !bottoms.some((x) => x.formality >= 4)) {
    add({ id: 'tailored-bottoms', title: 'Tailored trousers', why: 'You dress for work or events, and none of your bottoms are tailored.', severity: 'high', typeIds: ['trousers'] });
  }
  if ((occasions.has('work') || occasions.has('formal')) && !shoes.some((x) => x.formality >= 3.5)) {
    add({ id: 'smart-shoes', title: 'Smart shoes', why: 'Nothing in your shoe rack is dressy enough for work or events.', severity: 'medium', typeIds: profile.department === 'women' ? ['flats', 'loafers'] : ['loafers', 'dressshoes'] });
  }
  if ((occasions.has('work') || occasions.has('formal') || occasions.has('date')) && !outer.some((x) => x.type === 'blazer')) {
    add({ id: 'blazer', title: 'A blazer', why: 'One blazer instantly lifts everything you own.', severity: 'medium', typeIds: ['blazer'] });
  }
  if (tops.length >= 6 && bottoms.length * 3 <= tops.length) {
    add({ id: 'more-bottoms', title: 'More bottoms', why: `You have ${tops.length} tops but only ${bottoms.length} ${bottoms.length === 1 ? 'bottom' : 'bottoms'}, so outfits keep repeating.`, severity: 'high', typeIds: ['chinos', 'jeans'] });
  } else if (bottoms.filter((x) => colorRole(x.color) === 'neutral').length < 2 && tops.length >= 3) {
    add({ id: 'neutral-bottoms', title: 'A neutral pair of trousers', why: 'Neutral bottoms go with every top you own.', severity: 'medium', typeIds: ['chinos', 'trousers'] });
  }
  if (profile.department === 'women' && occasions.has('events') && !g.some((x) => x.category === 'dress')) {
    add({ id: 'dress', title: 'A versatile dress', why: 'You shop for events and have no dresses.', severity: 'medium', typeIds: ['dress'] });
  }
  if (shoes.length < 2 && g.length > 0) {
    add({ id: 'second-shoes', title: 'A second pair of shoes', why: 'One pair cannot cover every day and every outfit.', severity: 'medium', typeIds: ['sneakers', 'boots'] });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return gaps.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 8);
}

/** Gaps with concrete, purchasable suggestions attached. */
export function gapSuggestions({ wardrobe, profile, days, catalog, linker, storeMode = 'mix' }) {
  const owned = prepareGarments(wardrobe);
  const budgetCaps = Object.fromEntries(Object.entries(BUDGET_KEY).map(([cat, key]) => [cat, profile.budget?.[key]]));
  const ctx = { profile, catalog, linker, budgetCaps };
  return findGaps({ wardrobe, profile, days }).map((gap) => {
    // best colour per type first, then second-best, so suggestions vary by garment as well as colour
    const perType = gap.typeIds.map((t) => bestColors(t, owned, profile, 2).map((p) => ({ ...p, type: t })));
    const picks = [];
    for (let round = 0; round < 2; round++) for (const list of perType) if (list[round] && picks.length < 3) picks.push(list[round]);
    const retailers = assignRetailers(picks.map((p) => p.piece), profile, storeMode === 'single' ? 'single' : 'mix');
    const pieces = picks.map((p) => {
      const retailer = retailers.get(p.piece.id);
      return retailer ? { ...pieceCard({ slot: p.piece.category, piece: p.piece }, retailer, ctx), pairsWith: p.partners } : null;
    }).filter(Boolean);
    return { ...gap, id: `${gap.id}-${hashString(gap.id).toString(36)}`, pieces };
  }).filter((g) => g.pieces.length);
}

export { queryFor };
