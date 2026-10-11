import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paintDisc, paintLine, eraseSimilar, initialMask, applyMask } from '../src/shared/touchup.js';

const solid = (w, h, fn) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      const i = (y * w + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
};

describe('touch-up editing', () => {
  test('erasing and restoring paint a soft-edged disc and report what changed', () => {
    const mask = new Uint8Array(100 * 100).fill(255);
    const box = paintDisc(mask, 100, 100, 50, 50, 10, 0);
    assert.equal(mask[50 * 100 + 50], 0);
    assert.equal(mask[50 * 100 + 80], 255);
    assert.ok(box.x <= 39 && box.x + box.w >= 61);
    paintDisc(mask, 100, 100, 50, 50, 10, 255);
    assert.equal(mask[50 * 100 + 50], 255);
  });

  test('a stroke covers the whole path and stays inside the image', () => {
    const mask = new Uint8Array(60 * 60).fill(255);
    paintLine(mask, 60, 60, -10, 30, 80, 30, 4, 0);
    for (const x of [0, 15, 30, 45, 59]) assert.equal(mask[30 * 60 + x], 0);
    assert.equal(mask[10 * 60 + 30], 255);
  });

  test('tap-to-erase removes the connected patch of the same colour and nothing else', () => {
    // cream backdrop, navy garment, and a second cream patch that is cut off from the first by the garment
    const img = solid(120, 80, (x) => (x > 40 && x < 60 ? [30, 44, 90] : [236, 228, 210]));
    const mask = new Uint8Array(120 * 80).fill(255);
    const box = eraseSimilar(img, mask, 10, 40, 16);
    assert.ok(box);
    assert.equal(mask[40 * 120 + 10], 0);
    assert.equal(mask[40 * 120 + 50], 255, 'garment erased');
    assert.equal(mask[40 * 120 + 100], 255, 'unconnected patch erased');
  });

  test('tap-to-erase does not spread through what is already erased', () => {
    const img = solid(100, 100, () => [30, 44, 90]); // one colour everywhere
    const mask = new Uint8Array(100 * 100).fill(255);
    for (let y = 48; y < 52; y++) for (let x = 0; x < 100; x++) mask[y * 100 + x] = 0; // an erased band across the middle
    eraseSimilar(img, mask, 50, 20, 16);
    assert.equal(mask[20 * 100 + 50], 0, 'the tapped half should go');
    assert.equal(mask[80 * 100 + 50], 255, 'the half behind the erased band should stay');
    assert.equal(eraseSimilar(img, mask, 50, 49, 16), null, 'tapping something already erased does nothing');
  });

  test('tap-to-erase also takes the faint rim around what it erased', () => {
    const img = solid(100, 100, (x) => (x < 50 ? [30, 44, 90] : [236, 228, 210]));
    const mask = new Uint8Array(100 * 100).fill(255);
    for (let y = 0; y < 100; y++) for (let x = 50; x < 100; x++) mask[y * 100 + x] = 0; // the backdrop is already gone
    for (let y = 0; y < 100; y++) mask[y * 100 + 49] = 90; // a half-transparent rim on the garment's edge
    eraseSimilar(img, mask, 10, 50, 16);
    for (let y = 5; y < 95; y++) assert.equal(mask[y * 100 + 49], 0, `rim left at row ${y}`);
  });

  test('a tap that does nothing reports nothing', () => {
    const img = solid(40, 40, () => [200, 200, 200]);
    const mask = new Uint8Array(40 * 40);
    assert.equal(eraseSimilar(img, mask, 20, 20, 10), null);
  });

  test('the starting mask follows the automatic cut-out, or keeps everything when it refuses', () => {
    const tee = solid(300, 300, (x, y) => (x > 90 && x < 210 && y > 80 && y < 240 ? [28, 44, 90] : [244, 244, 242]));
    const a = initialMask(tee);
    assert.equal(a.auto, true);
    assert.ok(a.mask[150 * 300 + 150] > 250);
    assert.ok(a.mask[10 * 300 + 10] < 5);
    const same = solid(300, 300, () => [240, 240, 238]);
    const b = initialMask(same);
    assert.equal(b.auto, false);
    assert.ok(b.mask.every((v) => v === 255));
  });

  test('applying crops to what is kept, writes the alpha, and refuses an empty result', () => {
    const img = solid(200, 200, (x) => [x, 10, 20]);
    const mask = new Uint8Array(200 * 200);
    for (let y = 60; y < 140; y++) for (let x = 50; x < 150; x++) mask[y * 200 + x] = 255;
    const out = applyMask(img, mask);
    assert.ok(out.width < 200 && out.height < 200);
    assert.equal(out.data[3], 0, 'corner should be transparent');
    assert.equal(out.data[(Math.floor(out.height / 2) * out.width + Math.floor(out.width / 2)) * 4 + 3], 255);
    assert.equal(applyMask(img, new Uint8Array(200 * 200)), null);
    const big = applyMask(solid(2000, 1000, () => [1, 2, 3]), new Uint8Array(2000 * 1000).fill(255), { maxSide: 900 });
    assert.ok(Math.max(big.width, big.height) <= 900);
  });
});
