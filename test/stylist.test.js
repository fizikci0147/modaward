import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, prepareGarments } from '../src/engine/outfit.js';
import { starterWardrobe } from '../src/services/starter.js';
import { occasionSpec, ownedAllowed, stylePenalty } from '../src/engine/stylist.js';
import { normalizePrefs } from '../src/engine/scoring.js';
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
  test('an outfit never has two tops, whatever the weather, occasion or closet', () => {
    for (const dept of ['men', 'women', 'unisex']) {
      const garments = wardrobe(dept);
      for (const d of WEATHER) for (const occasion of OCCASION_IDS) {
        for (const o of recommend({ garments, day: d, occasion, seed: 's', count: 3 }).outfits) {
          const items = describeOutfit(garments, o);
          assert.ok(items.filter((i) => i.category === 'top').length <= 1, `${dept}/${occasion}: ${items.map((i) => i.name)}`);
        }
      }
    }
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
