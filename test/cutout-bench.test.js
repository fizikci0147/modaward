import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segment, renderCutout } from '../src/shared/cutout.js';
import { BACKDROPS, SHAPES, GARMENTS, scene, iou } from './cutout/scenes.js';

// A fixed set of synthetic "photos of clothes on a surface" (4 surfaces × 6 garment/shape pairs, with soft shadows,
// wrinkles, stripes, prints and camera noise). It cannot stand in for real photos, but it catches regressions in
// how often the automatic cut-out is good, and in how often it is confidently wrong.
const shapes = Object.keys(SHAPES);
const garments = Object.keys(GARMENTS);
const rows = [];
let seed = 1;
for (const backdrop of Object.keys(BACKDROPS)) {
  for (let k = 0; k < 6; k++) {
    const shape = shapes[(k + seed) % shapes.length];
    const garment = garments[(k * 3 + seed) % garments.length];
    seed += 1;
    const { img, truth } = scene({ backdrop, shape, garment, seed });
    const t0 = performance.now();
    const seg = segment(img);
    rows.push({ name: `${backdrop} / ${shape} / ${garment}`, seg, ms: performance.now() - t0, iou: seg.ok ? iou(seg, truth, img.width, img.height) : 0, img });
  }
}

test('the benchmark scenes are cut out well, and never confidently wrong', () => {
  const accepted = rows.filter((r) => r.seg.ok);
  const good = rows.filter((r) => r.iou > 0.9);
  const wrong = accepted.filter((r) => r.iou < 0.6).map((r) => r.name);
  assert.ok(good.length >= 22, `only ${good.length} of ${rows.length} cut out cleanly`);
  assert.ok(accepted.length >= 32, `only ${accepted.length} of ${rows.length} accepted`);
  assert.deepEqual(wrong, [], `accepted but badly wrong: ${wrong.join('; ')}`);
});

test('every scene is cut out within a second on this machine', () => {
  const slow = rows.filter((r) => r.ms > 1000).map((r) => r.name);
  assert.deepEqual(slow, []);
});

test('full-resolution edges are at least as accurate as the coarse mask', () => {
  let coarse = 0;
  let fine = 0;
  // render with and without the edge refinement and compare each against the truth at full size
  const measure = (img, truth, seg) => {
    const out = renderCutout(img, seg, { maxSide: 4000 });
    const { x, y, w, h } = out.box;
    let inter = 0;
    let union = 0;
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        let m = false;
        if (i >= x && i < x + w && j >= y && j < y + h) {
          const ox = Math.min(out.width - 1, Math.floor(((i - x) / w) * out.width));
          const oy = Math.min(out.height - 1, Math.floor(((j - y) / h) * out.height));
          m = out.data[(oy * out.width + ox) * 4 + 3] > 127;
        }
        const t = truth[j * img.width + i] === 1;
        if (m && t) inter += 1;
        if (m || t) union += 1;
      }
    }
    return inter / union;
  };
  let s2 = 100;
  for (const backdrop of Object.keys(BACKDROPS)) {
    for (let k = 0; k < 2; k++) {
      s2 += 1;
      const { img, truth } = scene({ backdrop, shape: shapes[k], garment: garments[k], seed: s2, w: 600, h: 600 });
      const seg = segment(img);
      if (!seg.ok) continue;
      coarse += measure(img, truth, { ...seg, refine: undefined });
      fine += measure(img, truth, seg);
    }
  }
  assert.ok(fine >= coarse - 0.005, `refined ${fine.toFixed(3)} vs coarse ${coarse.toFixed(3)}`);
});
