import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';
import { wardrobeStats } from '../src/shared/wardrobe-stats.js';
import { packTrip } from '../src/engine/trip.js';
import { closet, MILD, COLD_RAIN } from './fixtures.js';

const unix = (date) => Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000);

describe('wardrobe stats (pure)', () => {
  const g = (id, o = {}) => ({ id, name: id, type: 'tee', category: 'top', color: '#fff', wearCount: 0, lastWornOn: null, createdAt: unix('2026-01-01'), ...o });
  const garments = [
    g('coat', { category: 'outerwear', priceCents: 30000, wearCount: 2, lastWornOn: '2026-10-01' }),
    g('tee', { priceCents: 2000, wearCount: 40, lastWornOn: '2026-10-05' }),
    g('jeans', { category: 'bottom', priceCents: 8000, wearCount: 16, lastWornOn: '2026-10-04' }),
    g('gown', { category: 'dress', priceCents: 50000, wearCount: 0 }),
    g('sock', { category: 'accessory', wearCount: 5, lastWornOn: '2026-05-01' }),
    g('old', { archived: true, wearCount: 9 })
  ];
  const stats = wardrobeStats({ garments, counts30: new Map([['tee', 12], ['jeans', 6], ['coat', 1]]), counts90: new Map([['tee', 30], ['jeans', 12], ['coat', 2], ['sock', 1]]), today: '2026-10-06' });

  test('counts only live pieces and reports how much of the closet gets worn', () => {
    assert.equal(stats.pieces, 5);
    assert.equal(stats.worn30, 3);
    assert.equal(stats.utilization30, 60);
    assert.equal(stats.worn90, 4);
    assert.equal(stats.neverWorn, 1);
    assert.equal(stats.totalWears, 63);
  });
  test('cost per wear: best value, and what is worth wearing more', () => {
    assert.equal(stats.totalValueCents, 90000);
    assert.equal(stats.pricedCount, 4);
    assert.deepEqual(stats.bestValue.map((p) => p.id), ['tee', 'jeans', 'coat']);
    assert.equal(stats.bestValue[0].cpwCents, 50);
    assert.equal(stats.bestValue[1].cpwCents, 500);
    // coat is $150/wear so far and the gown has cost $500 without being worn
    assert.deepEqual(stats.worthWearing.map((p) => p.id), ['gown', 'coat']);
    assert.equal(stats.worthWearing[0].cpwCents, 50000);
    assert.equal(stats.avgCpwCents, Math.round((50 + 500 + 15000) / 3));
  });
  test('most worn, forgotten pieces and category mix', () => {
    assert.deepEqual(stats.mostWorn.map((p) => p.id), ['tee', 'jeans', 'sock', 'coat']);
    assert.equal(stats.mostWorn[0].cpwCents, 50);
    assert.ok(stats.dormantTop.some((p) => p.id === 'gown'));
    assert.ok(stats.dormantTop.some((p) => p.id === 'sock'));
    assert.deepEqual(stats.byCategory.find((c) => c.category === 'top'), { category: 'top', pieces: 1, wears: 40, worn30: 1 });
  });
  test('an empty or unpriced closet does not divide by zero', () => {
    const e = wardrobeStats({ garments: [], counts30: new Map(), counts90: new Map(), today: '2026-10-06' });
    assert.equal(e.utilization30, 0);
    assert.equal(e.avgCpwCents, null);
    assert.equal(e.hasWearData, false);
  });
});

describe('packing a trip (engine)', () => {
  const days = (n, day = MILD) => Array.from({ length: n }, (_, i) => ({ ...day, date: `2026-10-${String(7 + i).padStart(2, '0')}` }));
  test('five days, casual: a small bag where pieces are worn more than once', () => {
    const r = packTrip({ garments: closet(), days: days(5), occasions: ['casual'], seed: 's' });
    assert.equal(r.plan.length, 5);
    assert.ok(r.pieces <= 11, `packed ${r.pieces}`);
    assert.ok(r.avgWears > 1.4, `avg wears ${r.avgWears}`);
    assert.ok(r.pack.filter((p) => p.item.category === 'shoes').length <= 2);
    assert.ok(r.pack.filter((p) => p.item.category === 'outerwear').length <= 2);
  });

  test('every outfit is built from pieces that are in the bag, and the bag holds nothing unused', () => {
    const r = packTrip({ garments: closet(), days: days(4), occasions: ['casual', 'evening'], seed: 'x' });
    const inBag = new Set(r.pack.map((p) => p.item.id));
    const used = new Set();
    for (const s of r.plan) for (const id of s.outfit.itemIds) (assert.ok(inBag.has(id)), used.add(id));
    assert.equal(used.size, inBag.size);
    for (const p of r.pack) assert.ok(p.usedOn.length >= 1);
    assert.equal(r.plan.length, 8);
  });

  test('reuse beats giving each day an all-new outfit', () => {
    const planned = packTrip({ garments: closet(), days: days(6), occasions: ['casual'], seed: 's' });
    const distinct = new Set();
    for (const d of days(6)) {
      const first = packTrip({ garments: closet(), days: [d], occasions: ['casual'], seed: 's' });
      first.pack.forEach((p) => distinct.add(p.item.id));
    }
    assert.ok(planned.pieces <= distinct.size, `${planned.pieces} vs ${distinct.size}`);
  });

  test('wet weather brings a waterproof layer', () => {
    const r = packTrip({ garments: closet(), days: days(3, COLD_RAIN), occasions: ['casual'], seed: 's' });
    assert.ok(r.pack.some((p) => p.item.waterproof || p.item.type === 'umbrella'), 'something for the rain');
  });

  test('a closet with nothing to wear reports what is missing instead of failing', () => {
    const r = packTrip({ garments: [], days: days(2), occasions: ['casual'], seed: 's' });
    assert.equal(r.plan.length, 0);
    assert.equal(r.missing.length, 2);
    assert.equal(r.avgWears, 0);
  });
});

describe('tier 2 API', () => {
  let t;
  before(async () => {
    t = await startTestServer();
  });
  after(() => t.close());

  async function person(plan) {
    const c = t.client();
    const reg = await registerUser(c);
    await c.patch('/api/profile', { location: NYC, department: 'men' });
    await c.post('/api/garments/starter', { department: 'men' });
    if (plan) t.deps.repos.users.setPlan(reg.user.id, { plan, status: 'active' });
    return { c, id: reg.user.id };
  }

  test('what a piece cost: saved, shown in cents, changed, cleared', async () => {
    const { c } = await person();
    const made = (await c.post('/api/garments', { type: 'tee', color: '#112233', price: 49.9 })).json.garment;
    assert.equal(made.priceCents, 4990);
    assert.equal((await c.patch(`/api/garments/${made.id}`, { price: 60 })).json.garment.priceCents, 6000);
    assert.equal((await c.patch(`/api/garments/${made.id}`, { name: 'Renamed' })).json.garment.priceCents, 6000, 'untouched by other edits');
    assert.equal((await c.patch(`/api/garments/${made.id}`, { price: 0 })).json.garment.priceCents, null);
    assert.equal((await c.post('/api/garments', { type: 'tee', color: '#112233', price: -5 })).status, 400);
    assert.equal((await c.post('/api/garments', { type: 'tee', color: '#112233' })).json.garment.priceCents, null);
  });

  test('currency is a profile setting with a short allowed list', async () => {
    const { c } = await person();
    assert.equal((await c.get('/api/profile')).json.profile.currency, 'USD');
    assert.equal((await c.patch('/api/profile', { currency: 'TRY' })).status, 200);
    assert.equal((await c.get('/api/profile')).json.profile.currency, 'TRY');
    assert.equal((await c.patch('/api/profile', { currency: 'DOGE' })).status, 400);
  });

  test('wardrobe insights follow the wear log', async () => {
    const { c } = await person();
    const [a, b] = (await c.get('/api/garments')).json.garments;
    await c.patch(`/api/garments/${a.id}`, { price: 100 });
    for (const day of ['2026-10-01', '2026-10-03', '2026-10-05']) await c.post(`/api/garments/${a.id}/worn`, { date: day });
    await c.post(`/api/garments/${b.id}/worn`, { date: '2026-08-01' });
    const { stats } = (await c.get('/api/insights/wardrobe?today=2026-10-06')).json;
    assert.equal(stats.totalWears, 4);
    assert.equal(stats.worn30, 1, 'only the recent wears count toward the last 30 days');
    assert.equal(stats.worn90, 2);
    assert.equal(stats.mostWorn[0].id, a.id);
    assert.equal(stats.mostWorn[0].cpwCents, Math.round(10000 / 3));
    assert.equal(stats.bestValue[0].id, a.id);
    assert.equal((await t.client().get('/api/insights/wardrobe')).status, 401);
  });

  test('events: a planned day sets the occasion; Today, Week and the day itself agree', async () => {
    const { c } = await person();
    const today = (await c.post('/api/outfits/recommend', {})).json.date;
    assert.equal((await c.post('/api/outfits/recommend', {})).json.occasion, 'casual');
    const put = await c.put(`/api/plans/${today}`, { occasion: 'formal', note: 'Wedding <b>day</b>' });
    assert.equal(put.status, 200);
    assert.equal(put.json.plan.note, 'Wedding bday/b');
    assert.doesNotMatch(put.json.plan.note, /[<>]/);
    const rec = (await c.post('/api/outfits/recommend', {})).json;
    assert.equal(rec.occasion, 'formal');
    assert.equal(rec.plan.occasion, 'formal');
    assert.equal((await c.post('/api/outfits/recommend', { occasion: 'casual' })).json.occasion, 'casual', 'an explicit choice still wins');
    const week = (await c.post('/api/plan', {})).json;
    assert.equal(week.days[0].occasion, 'formal');
    assert.equal(week.days[0].plan.note, 'Wedding bday/b');
    assert.equal(week.days[1].plan, null);
    assert.equal((await c.get(`/api/plans?from=${today}`)).json.plans.length, 1);
    assert.equal((await c.del(`/api/plans/${today}`)).status, 200);
    assert.equal((await c.post('/api/outfits/recommend', {})).json.occasion, 'casual');
  });

  test('events: validated, private, bounded', async () => {
    const a = await person();
    const b = await person();
    assert.equal((await a.c.put('/api/plans/2026-10-06', { occasion: 'party' })).status, 400);
    assert.equal((await a.c.put('/api/plans/not-a-date', { occasion: 'work' })).status, 400);
    assert.equal((await a.c.put('/api/plans/2001-01-01', { occasion: 'work' })).status, 400, 'the distant past is not plannable');
    assert.equal((await a.c.put('/api/plans/2999-01-01', { occasion: 'work' })).status, 400, 'nor the far future');
    const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await a.c.put(`/api/plans/${day}`, { occasion: 'work', note: 'x'.repeat(61) }).then((r) => assert.equal(r.status, 400));
    await a.c.put(`/api/plans/${day}`, { occasion: 'work' });
    assert.equal((await b.c.get(`/api/plans?from=${day}`)).json.plans.length, 0);
    assert.equal((await t.client().get('/api/plans')).status, 401);
  });

  test('trip: a packing list for the destination’s weather, with plan limits', async () => {
    const free = await person();
    const r = await free.c.post('/api/trips/plan', { days: 3, occasions: ['casual'], location: { name: 'Oslo', lat: 59.9, lon: 10.7 } });
    assert.equal(r.status, 200);
    assert.equal(r.json.destination.name, 'Oslo');
    assert.equal(r.json.plan.length, 3);
    assert.ok(r.json.pieces >= 3);
    assert.ok(r.json.pack.every((p) => p.item.id && p.usedOn.length));
    assert.equal(r.json.covered, 3);
    // the free plan stops at three days; Pro goes the whole forecast window
    assert.equal((await free.c.post('/api/trips/plan', { days: 5, occasions: ['casual'] })).status, 402);
    const pro = await person('pro');
    const long = await pro.c.post('/api/trips/plan', { days: 6, occasions: ['casual', 'evening'] });
    assert.equal(long.status, 200);
    assert.equal(long.json.plan.length, 12);
    assert.equal(long.json.destination.name, NYC.name, 'defaults to home');
  });

  test('trip: validation', async () => {
    const { c } = await person('pro');
    for (const bad of [{ days: 0, occasions: ['casual'] }, { days: 9, occasions: ['casual'] }, { days: 3, occasions: [] }, { days: 3, occasions: ['party'] }, { days: 3, occasions: ['casual', 'work', 'evening', 'formal'] }, { days: 3, occasions: ['casual'], startOffset: 9 }, { days: 3, occasions: ['casual'], location: { name: 'x', lat: 999, lon: 0 } }]) {
      assert.equal((await c.post('/api/trips/plan', bad)).status, 400, JSON.stringify(bad));
    }
    assert.equal((await t.client().post('/api/trips/plan', { days: 2, occasions: ['casual'] })).status, 401);
  });
});
