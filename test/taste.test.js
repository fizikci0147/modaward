import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TasteModel, features, withTaste } from '../src/ai/taste.js';
import { recommend, prepareGarments } from '../src/engine/outfit.js';
import { normalizePrefs } from '../src/engine/scoring.js';
import { closet, MILD } from './fixtures.js';

const items = (types) => prepareGarments(closet()).filter((g) => types.includes(g.type));

describe('taste model', () => {
  test('starts neutral and is stable for unknown input', () => {
    const m = new TasteModel();
    const p = m.predict(items(['tee', 'jeans', 'sneakers']));
    assert.ok(Math.abs(p - 0.35) < 1e-9);
  });

  test('loving an outfit raises its probability, disliking lowers it', () => {
    const m = new TasteModel();
    const loved = items(['polo', 'chinos', 'loafers']);
    const hated = items(['hoodie', 'joggers', 'sandals']);
    for (let i = 0; i < 6; i++) {
      m.learn(loved, 'love');
      m.learn(hated, 'dislike');
    }
    assert.ok(m.predict(loved) > 0.8, `loved ${m.predict(loved)}`);
    assert.ok(m.predict(hated) < 0.1, `hated ${m.predict(hated)}`);
  });

  test('generalises: liking navy/classic pieces lifts unseen outfits that share features', () => {
    const m = new TasteModel();
    const base = m.predict(items(['polo', 'trousers']));
    for (let i = 0; i < 8; i++) m.learn(items(['polo', 'chinos', 'loafers']), 'love');
    assert.ok(m.predict(items(['polo', 'trousers'])) > base + 0.1);
  });

  test('serialises and restores without losing behaviour', () => {
    const m = new TasteModel();
    for (let i = 0; i < 5; i++) m.learn(items(['polo', 'chinos']), 'love');
    const restored = new TasteModel(JSON.parse(JSON.stringify(m.toJSON())));
    const probe = items(['polo', 'chinos']);
    assert.ok(Math.abs(m.predict(probe) - restored.predict(probe)) < 0.01);
    assert.equal(restored.n, 5);
  });

  test('rejects unknown signals', () => {
    assert.throws(() => new TasteModel().learn(items(['tee']), 'meh'));
  });

  test('model size stays bounded', () => {
    const m = new TasteModel();
    const all = prepareGarments(closet());
    for (let i = 0; i < 400; i++) m.learn([all[i % all.length], all[(i * 7) % all.length]], i % 2 ? 'love' : 'dislike');
    assert.ok(Object.keys(m.w).length <= 1500);
  });

  test('features include pairings', () => {
    const f = features(items(['polo', 'chinos', 'loafers']));
    assert.ok(f.includes('pair:polo+chinos'));
    assert.ok(f.includes('pair:chinos+loafers'));
  });

  test('feedback changes what the engine recommends', () => {
    const garments = closet();
    const before = recommend({ garments, day: MILD, occasion: 'casual', seed: 1, count: 1 }).outfits[0];
    // teach the model to hate whatever it recommended first
    const model = new TasteModel();
    const prepared = prepareGarments(garments);
    const picked = prepared.filter((g) => before.itemIds.includes(g.id));
    for (let i = 0; i < 10; i++) model.learn(picked, 'dislike');
    const prefs = withTaste(normalizePrefs(null), model);
    assert.ok(prefs.taste);
    const after = recommend({ garments, day: MILD, occasion: 'casual', seed: 1, count: 1, prefs }).outfits[0];
    assert.notEqual(after.key, before.key);
  });
});
