import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, prepareGarments } from '../src/engine/outfit.js';
import { starterWardrobe } from '../src/services/starter.js';
import { occasionSpec, ownedAllowed, stylePenalty, layerOk, trendBonus, selectionPenalty } from '../src/engine/stylist.js';
import { seasonOf, configureTrends } from '../src/shared/trends.js';
import { normalizePrefs, garmentAffinity } from '../src/engine/scoring.js';
import { OCCASION_IDS } from '../src/shared/taxonomy.js';
import { day } from './fixtures.js';

const WEATHER = [
  day({ min: -4, max: 3, code: 71, rainProb: 60, rainMm: 2 }),
  day({ min: 2, max: 8, code: 3 }),
  day({ min: 10, max: 16, code: 2 }),
  day({ min: 14, max: 22, code: 2 }),
  day({ min: 24, max: 32, code: 0 }),
  day({ min: 8, max: 12, rainProb: 90, rainMm: 8, code: 63 })
];
const wardrobe = (dept) => starterWardrobe(dept).map((g, i) => ({ id: `${dept}${i}`, ...g }));
const describeOutfit = (garments, o) => {
  const by = new Map(prepareGarments(garments).map((g) => [g.id, g]));
  return o.itemIds.map((id) => by.get(id));
};

describe('the stylist', () => {
  test('two tops only as a real layered look: a base with the layer that belongs over it, on a cool day', () => {
    for (const dept of ['men', 'women', 'unisex']) {
      const garments = wardrobe(dept);
      for (const d of WEATHER) for (const occasion of OCCASION_IDS) {
        const outfits = recommend({ garments, day: d, occasion, seed: 's', count: 3 }).outfits;
        for (const o of outfits) {
          const tops = describeOutfit(garments, o).filter((i) => i.category === 'top');
          assert.ok(tops.length <= 2, `${dept}/${occasion}: three tops`);
          if (tops.length === 2) {
            assert.ok(d.tMaxC < 18, `layered on a warm day (${d.tMaxC}°)`);
            assert.ok(tops.some((t) => layerOk(t, tops.find((x) => x !== t)) ), `${tops.map((t) => t.type)} is not a layered look`);
          }
        }
        // a list of looks is never made only of layered ones when a single-top look exists
        if (outfits.length >= 3 && outfits.some((o) => describeOutfit(garments, o).filter((i) => i.category === 'top').length === 1) === false) {
          const single = recommend({ garments, day: d, occasion, seed: 's', count: 12 }).outfits.some((o) => describeOutfit(garments, o).filter((i) => i.category === 'top').length === 1);
          assert.equal(single, false, 'all three were layered although single-top looks exist');
        }
      }
    }
  });

  test('layering pairs: shirt under a sweater yes, polo beside a button-up no', () => {
    const t = (type) => ({ id: type, type });
    assert.equal(layerOk(t('shirt'), t('sweater')), true);
    assert.equal(layerOk(t('tee'), t('cardigan')), true);
    assert.equal(layerOk(t('tee'), t('hoodie')), true);
    assert.equal(layerOk(t('polo'), t('shirt')), false);
    assert.equal(layerOk(t('tee'), t('sweater')), false);
    assert.equal(layerOk(t('hoodie'), t('cardigan')), false);
  });

  test('a layered look needs contrast and not two prints', () => {
    const cool = { avgFeels: 8, minFeels: 4, rain: 'none', snow: false };
    const parts = (a, b) => ({ upper: [a, b], bottom: null, dress: null, outer: null, shoes: null, accessories: [] });
    const base = { type: 'shirt', category: 'top', color: '#8fa9c8', pattern: 'solid' };
    const good = { type: 'sweater', category: 'top', color: '#1f2f54', pattern: 'solid', layer: 'either' };
    const same = { ...good, color: '#8fa9c8' };
    const loud = { ...good, pattern: 'checked' };
    const prefs = normalizePrefs({});
    assert.ok(stylePenalty(parts(base, same), cool, 'casual', prefs) > stylePenalty(parts(base, good), cool, 'casual', prefs));
    assert.ok(stylePenalty(parts({ ...base, pattern: 'striped' }, loud), cool, 'casual', prefs) >= 0.25);
    assert.ok(stylePenalty(parts(base, good), { ...cool, avgFeels: 24, minFeels: 20 }, 'casual', prefs) >= 0.4, 'not in the heat');
  });

  test('"never suggest" applies to the pieces the person owns', () => {
    const garments = wardrobe('men');
    const hot = day({ min: 24, max: 32, code: 0 });
    const prefs = normalizePrefs({ style: { never: ['shorts'] } });
    for (const occasion of ['casual', 'evening']) {
      const outfits = recommend({ garments, day: hot, occasion, seed: 's', count: 3, prefs }).outfits;
      assert.ok(outfits.length > 0);
      for (const o of outfits) assert.ok(!describeOutfit(garments, o).some((i) => i.type === 'shorts'), 'shorts were ruled out');
    }
    // ...unless that would leave a whole category empty: a disliked suggestion beats a blank screen
    const onlyShorts = garments.filter((g) => !['jeans', 'chinos', 'trousers'].includes(g.type));
    assert.ok(recommend({ garments: onlyShorts, day: hot, occasion: 'casual', seed: 's', prefs }).outfits.length > 0);
    assert.equal(ownedAllowed(normalizePrefs({ style: { avoidedPatterns: ['graphic'] } }))({ type: 'tee', pattern: 'graphic', name: 'Band tee' }), false);
    assert.equal(ownedAllowed(normalizePrefs({ style: { never: ['wool'] } }))({ type: 'sweater', pattern: 'solid', name: 'Merino sweater' }), false);
  });

  test('the dress code moves what each occasion means for this person', () => {
    const casual = normalizePrefs({ lifestyle: { dressCode: 'casual' } });
    const business = normalizePrefs({ lifestyle: { dressCode: 'business' } });
    assert.ok(occasionSpec('work', business).formality > occasionSpec('work', normalizePrefs({})).formality);
    assert.ok(occasionSpec('work', casual).formality < occasionSpec('work', normalizePrefs({})).formality);
    const garments = wardrobe('men');
    const mean = (prefs) => {
      const o = recommend({ garments, day: day({ min: 14, max: 22, code: 2 }), occasion: 'work', seed: 's', count: 1, prefs }).outfits[0];
      const items = describeOutfit(garments, o).filter((i) => i.category !== 'accessory');
      return items.reduce((s, i) => s + i.formality, 0) / items.length;
    };
    assert.ok(mean(business) >= mean(casual), 'a business dress code is dressier than a casual one');
  });

  test('shorts and sundresses stay out of weather that does not suit them', () => {
    const cool = { avgFeels: 12, minFeels: 8, rain: 'none', snow: false };
    const parts = (over) => ({ upper: [], bottom: null, dress: null, outer: null, shoes: null, accessories: [], ...over });
    const tee = { type: 'tee', category: 'top', color: '#ffffff' };
    const shorts = { type: 'shorts', category: 'bottom', color: '#cdb89a' };
    assert.ok(stylePenalty(parts({ upper: [tee], bottom: shorts }), cool, 'casual', normalizePrefs({})) >= 0.4);
    assert.ok(stylePenalty(parts({ dress: { type: 'sundress', category: 'dress', color: '#a1b49a' } }), cool, 'casual', normalizePrefs({})) >= 0.4);
    const warm = { avgFeels: 26, minFeels: 21, rain: 'none', snow: false };
    assert.ok(stylePenalty(parts({ upper: [tee], bottom: shorts }), warm, 'casual', normalizePrefs({})) < 0.05);
    assert.ok(stylePenalty(parts({ upper: [tee], bottom: shorts }), warm, 'work', normalizePrefs({})) >= 0.4, 'not for work');
  });

  test('sportswear and tailoring do not mix, except for people who love streetwear', () => {
    const ctx = { avgFeels: 12, minFeels: 8, rain: 'none', snow: false };
    const parts = { upper: [{ type: 'hoodie', category: 'top', layer: 'either', color: '#888888' }], bottom: { type: 'jeans', category: 'bottom', color: '#223355' }, dress: null, outer: { type: 'blazer', category: 'outerwear', color: '#223355' }, shoes: null, accessories: [] };
    const plain = stylePenalty(parts, ctx, 'casual', normalizePrefs({ style: { archetypes: { classic: 1 } } }));
    const street = stylePenalty(parts, ctx, 'casual', normalizePrefs({ style: { archetypes: { street: 1 } } }));
    assert.ok(plain >= 0.25 && street < plain);
  });

  test('prints follow taste: minimalists skip loud ones, boho loves florals', () => {
    const floral = { type: 'blouse', pattern: 'floral', styles: ['boho', 'polished'], color: '#d9a5b3' };
    const quiet = normalizePrefs({ style: { archetypes: { minimal: 1, boho: 0 } } });
    const boho = normalizePrefs({ style: { archetypes: { minimal: 0, boho: 1 } } });
    assert.ok(garmentAffinity(floral, boho) > garmentAffinity(floral, quiet));
  });

  test('a stated taste decides between otherwise equal outfits', () => {
    const garments = wardrobe('men');
    const cool = day({ min: 10, max: 16, code: 2 });
    const pick = (archetypes) => recommend({ garments, day: cool, occasion: 'casual', seed: 's', count: 3, profile: { style: { archetypes } } }).outfits.map((o) => describeOutfit(garments, o).map((i) => i.type).join(' '));
    const classic = pick({ classic: 1, polished: 0.8, street: 0, sporty: 0 }).join(' | ');
    const street = pick({ street: 1, sporty: 0.8, casual: 0.8, classic: 0, polished: 0 }).join(' | ');
    assert.doesNotMatch(classic, /hoodie/);
    assert.match(street, /hoodie|sneakers/);
  });
});

describe('trends', () => {
  const cool = { date: '2026-10-07', avgFeels: 9, minFeels: 5, rain: 'none', snow: false };
  const burgundySweater = { type: 'sweater', category: 'top', color: '#6d1f35', pattern: 'solid', layer: 'either' };
  const jeans = { type: 'jeans', category: 'bottom', color: '#2b3a55', pattern: 'solid' };
  const parts = { upper: [burgundySweater], bottom: jeans, dress: null, outer: null, shoes: null, accessories: [] };
  const classic = normalizePrefs({ style: { archetypes: { classic: 1, minimal: 0.6 } } });

  test('the season follows where the person lives', () => {
    assert.equal(seasonOf('2026-10-07', 'north'), 'fw');
    assert.equal(seasonOf('2026-10-07', 'south'), 'ss');
    assert.equal(seasonOf('2026-04-20', 'north'), 'ss');
  });

  test('a trend nudges an outfit the person likes', () => {
    const t = trendBonus(parts, cool, classic, 0.8);
    assert.ok(t.bonus > 0.02 && t.matched.some((m) => m.id === 'deep-red'));
  });

  test('a trend never rescues an outfit they would not enjoy, and can be switched off', () => {
    assert.equal(trendBonus(parts, cool, classic, 0.4).bonus, 0, 'not liked, so no lift');
    assert.equal(trendBonus(parts, cool, normalizePrefs({ style: { archetypes: { classic: 1 }, trendiness: 'off' } }), 0.9).bonus, 0);
    assert.ok(trendBonus(parts, cool, normalizePrefs({ style: { archetypes: { classic: 1 }, trendiness: 'forward' } }), 0.9).bonus > trendBonus(parts, cool, classic, 0.9).bonus);
  });

  test('a trend that is not their style is ignored', () => {
    const street = normalizePrefs({ style: { archetypes: { street: 1, classic: 0, minimal: 0, polished: 0 } } });
    const tonal = { upper: [{ type: 'sweater', category: 'top', color: '#b58750', pattern: 'solid' }], bottom: { type: 'chinos', category: 'bottom', color: '#cdb89a', pattern: 'solid' }, dress: null, outer: null, shoes: null, accessories: [] };
    assert.equal(trendBonus(tonal, cool, street, 0.9).matched.some((m) => m.id === 'tonal-warm'), false);
    assert.equal(trendBonus(tonal, cool, classic, 0.9).matched.some((m) => m.id === 'tonal-warm'), true);
  });

  test('a trend is only ever a tiebreak: the total lift is small', () => {
    const everything = { upper: [{ type: 'shirt', category: 'top', color: '#6d1f35', pattern: 'checked' }, { type: 'sweater', category: 'top', color: '#b58750', pattern: 'solid' }], bottom: { type: 'jeans', category: 'bottom', color: '#4b6a93', pattern: 'solid' }, dress: null, outer: { type: 'blazer', category: 'outerwear', color: '#b58750' }, shoes: { type: 'loafers', category: 'shoes', color: '#6b4a32' }, accessories: [] };
    assert.ok(trendBonus(everything, cool, classic, 1).bonus <= 0.06 + 1e-9);
  });

  test('the owner can replace the lists with their own', () => {
    configureTrends({ fw: [{ id: 'mine', label: 'my trend', weight: 0.05, match: { types: ['sweater'] } }] });
    try {
      assert.deepEqual(trendBonus(parts, cool, classic, 0.9).matched.map((m) => m.id), ['mine']);
    } finally {
      configureTrends(null);
    }
    assert.ok(trendBonus(parts, cool, classic, 0.9).matched.length >= 1);
  });

  test('"never suggest" pieces are skipped but a colour they avoid is nearly a veto', () => {
    const avoid = normalizePrefs({ style: { avoidedColors: ['burgundy'], likedColors: ['navy'] } });
    const liked = selectionPenalty({ ...parts, upper: [{ ...burgundySweater, color: '#1f2f54' }] }, avoid);
    const bad = selectionPenalty(parts, avoid);
    assert.ok(bad >= 0.15 && liked < 0);
  });
});
