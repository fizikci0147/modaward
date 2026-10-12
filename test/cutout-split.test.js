import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segment, renderCutout } from '../src/shared/cutout.js';
import { multiScene } from './cutout/scenes.js';

const threeApart = [
  { shape: 'tee', garment: 'navy, solid', ox: 10, oy: 20, scale: 0.7 },
  { shape: 'trousers', garment: 'red, solid', ox: 300, oy: 10, scale: 0.8 },
  { shape: 'dress', garment: 'light blue, solid', ox: 120, oy: 300, scale: 0.75 }
];

/** Best intersection-over-union of a truth mask against any of the found items. */
function bestIou(items, truth, w, h) {
  let best = 0;
  for (const it of items) {
    let inter = 0;
    let union = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = it.mask[Math.min(it.height - 1, Math.floor((y / h) * it.height)) * it.width + Math.min(it.width - 1, Math.floor((x / w) * it.width))] > 0.5;
        const t = truth[y * w + x] === 1;
        if (m && t) inter += 1;
        if (m || t) union += 1;
      }
    }
    best = Math.max(best, inter / union);
  }
  return best;
}

test('pieces lying apart on a surface come out as separate cut-outs', () => {
  for (const backdrop of ['white sheet', 'bed fabric', 'wooden floor']) {
    const { img, truths } = multiScene({ backdrop, parts: threeApart, seed: 3 });
    const seg = segment(img, { split: true });
    assert.equal(seg.ok, true, `${backdrop}: ${seg.reason}`);
    assert.equal(seg.items.length, 3, `${backdrop}: found ${seg.items.length} pieces`);
    truths.forEach((truth, k) => assert.ok(bestIou(seg.items, truth, img.width, img.height) > 0.9, `${backdrop}: piece ${k} was not cut out cleanly`));
  }
});

test('the pieces come out in reading order, each cropped to its own piece', () => {
  const { img } = multiScene({ backdrop: 'wooden floor', parts: threeApart, seed: 3 });
  const seg = segment(img, { split: true });
  const boxes = seg.items.map((it) => renderCutout(img, it, { maxSide: 400 }).box);
  assert.ok(boxes[0].x < boxes[1].x, 'top row goes left to right');
  assert.ok(boxes[2].y > boxes[0].y, 'lower row comes after');
  for (const b of boxes) assert.ok(b.w < img.width * 0.6 && b.h < img.height * 0.6, 'each crop is just one piece');
});

test('a single piece gives one item, and an ordinary photo is not reported as several', () => {
  const { img } = multiScene({ backdrop: 'bed fabric', parts: [{ shape: 'hoodie', garment: 'navy, solid', ox: 100, oy: 100, scale: 0.9 }], seed: 3 });
  assert.equal(segment(img, { split: true }).items.length, 1);
  assert.equal(segment(img).pieces, 1);
});

test('a photo with several pieces is reported as such, even when the one-piece cut-out refuses it', () => {
  const { img } = multiScene({ backdrop: 'white sheet', parts: threeApart, seed: 3 });
  assert.equal(segment(img).pieces, 3);
});

test('two near-identical pieces (a pair of shoes) are not offered as a split', () => {
  const shoes = [
    { shape: 'shoe', garment: 'navy, solid', ox: 30, oy: 20, scale: 0.6 },
    { shape: 'shoe', garment: 'navy, solid', ox: 300, oy: 280, scale: 0.6 }
  ];
  const { img } = multiScene({ backdrop: 'white sheet', parts: shoes, seed: 3 });
  assert.equal(segment(img).pieces, 1);
});

test('pieces too close in colour to the surface are left out rather than guessed', () => {
  const parts = [...threeApart.slice(0, 2), { shape: 'dress', garment: 'cream on light (hard)', ox: 120, oy: 300, scale: 0.75 }];
  const { img } = multiScene({ backdrop: 'bed fabric', parts, seed: 3 });
  const seg = segment(img, { split: true });
  assert.equal(seg.ok, true);
  assert.equal(seg.items.length, 2);
});
