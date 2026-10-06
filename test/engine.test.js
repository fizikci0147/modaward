import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/engine/outfit.js';
import { planWeek } from '../src/engine/planner.js';
import { requiredInsulation, garmentInsulation, thermalScore } from '../src/engine/thermal.js';
import { buildContext } from '../src/engine/context.js';
import { closet, day, COLD_RAIN, HOT_SUN, MILD, FREEZING } from './fixtures.js';

const byId = (garments) => new Map(garments.map((g) => [g.id, g]));

function describeOutfit(garments, outfit) {
  const m = byId(garments);
  return outfit.itemIds.map((id) => m.get(id).type);
}

describe('thermal model', () => {
  test('required insulation falls monotonically as it gets warmer', () => {
    let prev = Infinity;
    for (let t = -20; t <= 40; t += 2) {
      const v = requiredInsulation(t);
      assert.ok(v <= prev + 1e-9, `non-monotonic at ${t}`);
      prev = v;
    }
  });

  test('garment insulation interpolates between warmth ratings', () => {
    const a = garmentInsulation({ category: 'top', warmth: 2 });
    const b = garmentInsulation({ category: 'top', warmth: 3 });
    const mid = garmentInsulation({ category: 'top', warmth: 2.5 });
    assert.ok(mid > a && mid < b);
  });

  test('an outer layer that is only needed in the morning is flagged as sometimes', () => {
    const ctx = buildContext(day({ min: 4, max: 20 }));
    const parts = {
      upper: [{ category: 'top', warmth: 2 }],
      bottom: { category: 'bottom', warmth: 3 },
      dress: null,
      shoes: { category: 'shoes', warmth: 2 },
      outer: { category: 'outerwear', warmth: 3.5 },
      accessories: []
    };
    const result = thermalScore(parts, ctx);
    assert.equal(result.outer, 'sometimes');
  });
});

describe('weather-aware recommendations', () => {
  const garments = closet();

  test('cold heavy rain: waterproof outer, closed waterproof shoes, warm layers', () => {
    const { outfits, tips } = recommend({ garments, day: COLD_RAIN, occasion: 'casual', seed: 1, count: 3 });
    assert.ok(outfits.length >= 2);
    const best = outfits[0];
    const types = describeOutfit(garments, best);
    assert.ok(types.some((t) => ['raincoat', 'trench', 'parka'].includes(t)), `expected rain outerwear, got ${types}`);
    assert.ok(!types.includes('sandals') && !types.includes('shorts'));
    assert.ok(tips.some((t) => t.kind === 'rain'));
    assert.ok(best.protectionOk !== false);
    assert.ok(best.components.protection >= 60, `protection ${best.components.protection}`);
  });

  test('hot sunny day: light pieces, no heavy outerwear, sunglasses suggested', () => {
    const { outfits, tips } = recommend({ garments, day: HOT_SUN, occasion: 'casual', seed: 2, count: 3 });
    const best = outfits[0];
    const types = describeOutfit(garments, best);
    assert.ok(!types.some((t) => ['parka', 'wool-coat', 'sweater', 'hoodie', 'cardigan'].includes(t)), `too warm: ${types}`);
    assert.ok(types.includes('sunglasses'), `expected sunglasses in ${types}`);
    assert.ok(tips.some((t) => t.kind === 'uv'));
  });

  test('freezing snowy day: parka or coat, boots, cold-weather accessories', () => {
    const { outfits } = recommend({ garments, day: FREEZING, occasion: 'casual', seed: 3, count: 3 });
    const types = describeOutfit(garments, outfits[0]);
    assert.ok(types.some((t) => ['parka', 'wool-coat'].includes(t)), `types ${types}`);
    assert.ok(types.includes('waterproofboots'), `types ${types}`);
    assert.ok(types.includes('beanie') || types.includes('scarf'), `types ${types}`);
  });

  test('work occasion avoids athletic pieces; formal picks dress shoes', () => {
    const work = recommend({ garments, day: MILD, occasion: 'work', seed: 4, count: 3 });
    for (const o of work.outfits) {
      const types = describeOutfit(garments, o);
      assert.ok(!types.includes('joggers') && !types.includes('shorts'), `work outfit has ${types}`);
    }
    const formal = recommend({ garments, day: MILD, occasion: 'formal', seed: 4, count: 2 });
    const types = describeOutfit(garments, formal.outfits[0]);
    assert.ok(types.includes('dressshoes') || types.includes('loafers'), `formal: ${types}`);
    assert.ok(types.includes('blazer'), `formal: ${types}`);
  });

  test('outfits in one response are meaningfully different', () => {
    const { outfits } = recommend({ garments, day: MILD, occasion: 'casual', seed: 5, count: 3 });
    assert.equal(outfits.length, 3);
    const keys = new Set(outfits.map((o) => o.key));
    assert.equal(keys.size, 3);
  });

  test('same seed is deterministic; a different seed can change the order', () => {
    const a = recommend({ garments, day: MILD, occasion: 'casual', seed: 'x', count: 3 });
    const b = recommend({ garments, day: MILD, occasion: 'casual', seed: 'x', count: 3 });
    assert.deepEqual(a.outfits.map((o) => o.key), b.outfits.map((o) => o.key));
  });

  test('items worn yesterday are less likely to be chosen again', () => {
    const fresh = recommend({ garments, day: MILD, occasion: 'casual', seed: 6, count: 1 });
    const worn = fresh.outfits[0].itemIds.filter((id) => !['umbrella'].includes(id));
    const lastWorn = Object.fromEntries(worn.map((id) => [id, 1]));
    const next = recommend({ garments, day: MILD, occasion: 'casual', seed: 6, count: 1, history: { lastWorn, recentKeys: [fresh.outfits[0].key] } });
    assert.notEqual(next.outfits[0].key, fresh.outfits[0].key);
  });

  test('explanations are present and mention the weather', () => {
    const { outfits } = recommend({ garments, day: COLD_RAIN, occasion: 'casual', seed: 7, count: 1 });
    assert.ok(outfits[0].reasons.length >= 1);
    assert.ok(outfits[0].reasons.some((r) => r.kind === 'weather' || r.kind === 'protection'));
  });

  test('disliked colours are avoided and liked styles preferred', () => {
    const profile = { style: { archetypes: { classic: 0.95, street: 0.05 }, avoidedColors: ['yellow'], likedColors: ['navy'] } };
    const { outfits } = recommend({ garments, day: COLD_RAIN, occasion: 'casual', seed: 8, count: 3, profile });
    const m = byId(garments);
    // the yellow rain jacket must not lead when a trench/parka alternative exists
    const lead = outfits[0].itemIds.map((id) => m.get(id).name);
    assert.ok(!lead.includes('Yellow rain jacket'), `lead outfit used the avoided colour: ${lead}`);
  });

  test('empty or incomplete closets report what is missing instead of crashing', () => {
    const none = recommend({ garments: [], day: MILD });
    assert.deepEqual(none.outfits, []);
    assert.deepEqual(none.missing.sort(), ['bottom', 'top']);
    const topsOnly = recommend({ garments: garments.filter((g) => g.type === 'tee'), day: MILD });
    assert.deepEqual(topsOnly.missing, ['bottom']);
  });

  test('a closet with only a dress and shoes still produces an outfit', () => {
    const small = closet().filter((g) => ['sundress', 'sandals'].includes(g.type));
    const { outfits } = recommend({ garments: small, day: HOT_SUN });
    assert.equal(outfits.length, 1);
  });

  test('archived items are never recommended', () => {
    const list = closet();
    const archivedIds = new Set();
    for (const gm of list) if (gm.type === 'parka') { gm.archived = true; archivedIds.add(gm.id); }
    const { outfits } = recommend({ garments: list, day: FREEZING, seed: 1, count: 3 });
    for (const o of outfits) for (const id of o.itemIds) assert.ok(!archivedIds.has(id));
  });

  test('imperial units change tip wording only', () => {
    const metric = recommend({ garments, day: day({ min: 2, max: 18 }), units: 'metric' });
    const imperial = recommend({ garments, day: day({ min: 2, max: 18 }), units: 'imperial' });
    assert.deepEqual(metric.outfits.map((o) => o.key), imperial.outfits.map((o) => o.key));
    assert.match(imperial.tips.find((t) => t.kind === 'swing').text, /°F|°/);
  });
});

describe('week planner', () => {
  const garments = closet();
  const week = [
    day({ date: '2026-10-05', min: 10, max: 18 }),
    day({ date: '2026-10-06', min: 8, max: 15, rainProb: 80, rainMm: 6, code: 61 }),
    day({ date: '2026-10-07', min: 12, max: 20 }),
    day({ date: '2026-10-08', min: 12, max: 21 }),
    day({ date: '2026-10-09', min: 13, max: 22 }),
    day({ date: '2026-10-10', min: 14, max: 24 }),
    day({ date: '2026-10-11', min: 14, max: 25 })
  ];

  test('plans every day in chronological order with work/casual occasions', () => {
    const plan = planWeek({ garments, days: week, profile: null, seed: 1 });
    assert.equal(plan.length, 7);
    assert.deepEqual(plan.map((p) => p.date), week.map((d) => d.date));
    assert.equal(plan[0].occasion, 'work'); // Monday
    assert.equal(plan[5].occasion, 'casual'); // Saturday
    for (const p of plan) assert.ok(p.outfits.length >= 1);
  });

  test('spreads tops across the week', () => {
    const plan = planWeek({ garments, days: week, profile: null, seed: 1 });
    const m = byId(garments);
    const tops = plan.map((p) => p.outfits[0].slots.upper.map((id) => m.get(id).name).join('+'));
    assert.ok(new Set(tops).size >= 5, `too repetitive: ${tops}`);
  });

  test('the rainy day gets rain protection', () => {
    const plan = planWeek({ garments, days: week, profile: null, seed: 1 });
    const rainy = plan.find((p) => p.date === '2026-10-06');
    assert.ok(rainy.outfits[0].components.protection >= 55);
  });
});
