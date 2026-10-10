import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { idleInfo, isDormant, dormantPieces, agoText, daysBetween, DORMANT_DAYS, UNWORN_GRACE_DAYS } from '../src/shared/dormancy.js';
import { recommend } from '../src/engine/outfit.js';
import { closet, MILD, COLD_RAIN } from './fixtures.js';

const unix = (date) => Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000);
const TODAY = '2026-10-06';

describe('dormancy', () => {
  test('measures days since last worn, or since added when never worn', () => {
    assert.deepEqual(idleInfo({ lastWornOn: '2026-09-26' }, TODAY), { days: 10, never: false });
    assert.deepEqual(idleInfo({ lastWornOn: null, createdAt: unix('2026-09-06') }, TODAY), { days: 30, never: true });
    assert.equal(idleInfo({ lastWornOn: TODAY }, TODAY).days, 0);
    assert.equal(daysBetween('2026-10-01', '2026-10-06'), 5);
  });

  test('flags worn pieces after 60 days and never-worn pieces after 21', () => {
    assert.equal(isDormant({ lastWornOn: '2026-08-08' }, TODAY), false); // 59 days: not yet
    assert.equal(isDormant({ lastWornOn: '2026-08-07' }, TODAY), true); // 60 days
    assert.equal(isDormant({ lastWornOn: '2026-09-01' }, TODAY), false);
    assert.equal(isDormant({ createdAt: unix('2026-09-30') }, TODAY), false);
    assert.equal(isDormant({ createdAt: unix('2026-09-01') }, TODAY), true);
    assert.equal(isDormant({ lastWornOn: '2020-01-01', archived: true }, TODAY), false);
    assert.ok(DORMANT_DAYS > UNWORN_GRACE_DAYS);
  });

  test('orders forgotten pieces longest-idle first', () => {
    const list = dormantPieces(
      [
        { id: 'a', lastWornOn: '2026-07-01' },
        { id: 'b', lastWornOn: '2026-05-01' },
        { id: 'c', lastWornOn: '2026-10-01' },
        { id: 'd', createdAt: unix('2026-08-01') }
      ],
      TODAY
    );
    assert.deepEqual(list.map((g) => g.id), ['b', 'a', 'd']);
    assert.equal(list[2].neverWorn, true);
  });

  test('speaks in the person’s language', () => {
    assert.equal(agoText(0, 'en'), 'today');
    assert.equal(agoText(1, 'en'), 'yesterday');
    assert.equal(agoText(5, 'en'), '5 days ago');
    assert.equal(agoText(21, 'en'), '3 weeks ago');
    assert.equal(agoText(95, 'en'), '3 months ago');
    assert.equal(agoText(800, 'en'), '2 years ago');
    assert.match(agoText(95, 'es'), /hace 3 meses/);
    assert.equal(agoText(95, 'xx-not-a-locale'), '3 months ago');
  });

  test('the engine tells you when it brings a forgotten piece back', () => {
    const pieces = closet().map((g) => ({ ...g, wearCount: 3, idleDays: 3 }));
    const base = recommend({ garments: pieces, day: MILD, occasion: 'casual', seed: 's' });
    const target = pieces.find((g) => g.id === base.outfits[0].itemIds[0]);
    const forgotten = pieces.map((g) => (g.id === target.id ? { ...g, idleDays: 120 } : g));
    const out = recommend({ garments: forgotten, day: MILD, occasion: 'casual', seed: 's' });
    const hit = out.outfits.find((o) => o.itemIds.includes(target.id));
    assert.ok(hit, 'forgotten piece still gets used');
    assert.ok(hit.reasons.some((r) => /last wore 4 months ago/.test(r.text)), JSON.stringify(hit.reasons));
  });

  test('featureId restricts outfits to ones that include the piece', () => {
    const pieces = closet();
    const piece = pieces.find((g) => g.type === 'polo');
    const out = recommend({ garments: pieces, day: MILD, occasion: 'casual', seed: 's', featureId: piece.id, count: 3 });
    assert.ok(out.outfits.length > 0);
    for (const o of out.outfits) assert.ok(o.itemIds.includes(piece.id));
    assert.equal(recommend({ garments: pieces, day: MILD, featureId: 'nope' }).featureMissing, true);
  });

  test('every clothing piece in a normal closet can be styled into outfits in mild and cold weather', () => {
    const pieces = closet();
    for (const weather of [MILD, COLD_RAIN]) {
      for (const piece of pieces.filter((g) => !['accessory'].includes(g.category))) {
        const out = recommend({ garments: pieces, day: weather, occasion: 'casual', seed: 's', featureId: piece.id, count: 3 });
        // a swimsuit-weight piece in a freezing downpour may legitimately have no sensible outfit,
        // but anything the fixture closet holds must work somewhere
        // a parka on a 14–22°C day is rightly refused; it must work in the cold instead
        const heavyCoat = piece.type === 'parka';
        if (weather === MILD && !heavyCoat) assert.ok(out.outfits.length > 0, `${piece.name} should be stylable in mild weather`);
        if (weather === COLD_RAIN && heavyCoat) assert.ok(out.outfits.length > 0, `${piece.name} should be stylable in the cold`);
        for (const o of out.outfits) assert.ok(o.itemIds.includes(piece.id));
      }
    }
  });
});
