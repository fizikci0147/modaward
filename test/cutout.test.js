import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { segment, renderCutout, rgbToLab } from '../src/shared/cutout.js';
import { dominantColor } from '../src/shared/color.js';
import { rng } from '../src/engine/rng.js';

/** Build an RGBA image from a per-pixel function returning [r,g,b] and a ground-truth mask fn. */
function make(w, h, bgFn, shapeFn) {
  const data = new Uint8ClampedArray(w * h * 4);
  const truth = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = shapeFn(x, y);
      const c = s ?? bgFn(x, y);
      const i = (y * w + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
      truth[y * w + x] = s ? 1 : 0;
    }
  }
  return { img: { data, width: w, height: h }, truth };
}

// a T-shirt-ish silhouette in a 400×400 frame
const tee = (color) => (x, y) => {
  const body = x > 130 && x < 270 && y > 100 && y < 330;
  const sleeves = y > 100 && y < 190 && x > 70 && x < 330;
  return body || sleeves ? color : null;
};

function iou(seg, truth, w, h) {
  let inter = 0;
  let union = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = seg.mask[Math.min(seg.height - 1, Math.floor((y / h) * seg.height)) * seg.width + Math.min(seg.width - 1, Math.floor((x / w) * seg.width))] > 0.5;
      const t = truth[y * w + x] === 1;
      if (m && t) inter += 1;
      if (m || t) union += 1;
    }
  }
  return inter / union;
}

const white = () => [246, 246, 244];

describe('background removal', () => {
  test('a navy tee on a white sheet with a soft shadow is cut out cleanly', () => {
    const shadow = (x, y) => (y > 320 && y < 345 && x > 120 && x < 290 ? [214, 214, 212] : null);
    const { img, truth } = make(400, 400, (x, y) => shadow(x, y) ?? white(), tee([28, 44, 90]));
    const seg = segment(img);
    assert.equal(seg.ok, true, seg.reason);
    assert.ok(iou(seg, truth, 400, 400) > 0.93, `IoU ${iou(seg, truth, 400, 400)}`);
    // shadow area should not be foreground
    const sx = Math.floor((200 / 400) * seg.width);
    const sy = Math.floor((335 / 400) * seg.height);
    assert.ok(seg.mask[sy * seg.width + sx] < 0.3, 'shadow leaked into the cut-out');
  });

  test('white buttons or a light print inside the garment stay in', () => {
    const base = tee([28, 44, 90]);
    const withButtons = (x, y) => {
      const c = base(x, y);
      if (c && [150, 190, 230, 270].some((cy) => Math.hypot(x - 200, y - cy) < 6)) return [248, 248, 248];
      return c;
    };
    const { img } = make(400, 400, white, withButtons);
    const seg = segment(img);
    assert.equal(seg.ok, true);
    const px = (x, y) => seg.mask[Math.floor((y / 400) * seg.height) * seg.width + Math.floor((x / 400) * seg.width)];
    for (const cy of [150, 190, 230, 270]) assert.ok(px(200, cy) > 0.5, `button at ${cy} was cut out`);
  });

  test('a tote-bag handle loop is transparent, the bag is not', () => {
    const bag = (x, y) => {
      if (x > 100 && x < 300 && y > 200 && y < 360) return [150, 90, 50];
      const ring = Math.hypot(x - 200, y - 200);
      if (y < 200 && ring < 90 && ring > 72) return [150, 90, 50];
      return null;
    };
    const { img } = make(400, 400, white, bag);
    const seg = segment(img);
    assert.equal(seg.ok, true, seg.reason);
    const px = (x, y) => seg.mask[Math.floor((y / 400) * seg.height) * seg.width + Math.floor((x / 400) * seg.width)];
    assert.ok(px(200, 290) > 0.5, 'bag body missing');
    assert.ok(px(200, 150) < 0.4, 'handle loop interior should be see-through');
  });

  test('a noisy wooden-floor backdrop with a light-blue shirt', () => {
    const rand = rng(7);
    const wood = (x, y) => {
      const base = 130 + 20 * Math.sin(x / 9 + y / 70) + (rand() - 0.5) * 18;
      return [base + 40, base - 5, base - 50];
    };
    const { img, truth } = make(500, 400, wood, (x, y) => tee([150, 190, 230])(x * 0.8 + 40, y));
    const seg = segment(img);
    assert.equal(seg.ok, true, seg.reason);
    assert.ok(iou(seg, truth, 500, 400) > 0.85, `IoU ${iou(seg, truth, 500, 400)}`);
  });

  test('a two-tone backdrop (bed and wall) is modelled with two clusters', () => {
    const { img, truth } = make(400, 400, (x) => (x < 200 ? [232, 220, 200] : [170, 176, 184]), tee([120, 40, 52]));
    const seg = segment(img);
    assert.equal(seg.ok, true, seg.reason);
    assert.ok(iou(seg, truth, 400, 400) > 0.88);
  });

  test('a garment touching the frame edge is still handled', () => {
    const cropped = (x, y) => (x > 60 && x < 340 && y > 150 && y < 420 ? [40, 90, 60] : null);
    const { img } = make(400, 400, white, cropped);
    assert.equal(segment(img).ok, true);
  });

  test('refuses (keeps the original) when the garment matches the backdrop', () => {
    const { img } = make(400, 400, white, tee([240, 240, 238]));
    const seg = segment(img);
    assert.equal(seg.ok, false);
    assert.match(seg.reason, /low-contrast|nothing|no-clear/);
  });

  test('refuses dark-on-dark and busy backgrounds instead of guessing', () => {
    const dark = make(400, 400, () => [22, 22, 24], tee([30, 30, 34])).img;
    assert.equal(segment(dark).ok, false);
    const rand = rng(3);
    const busy = make(400, 400, () => [rand() * 255, rand() * 255, rand() * 255], tee([30, 44, 90])).img;
    assert.equal(segment(busy).ok, false);
  });

  test('transparent PNG input is trusted as is', () => {
    const { img } = make(200, 200, white, () => null);
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) img.data[(y * 200 + x) * 4 + 3] = x > 50 && x < 150 && y > 50 && y < 150 ? 255 : 0;
    const seg = segment(img);
    assert.equal(seg.alreadyTransparent, true);
    assert.equal(seg.ok, true);
  });

  test('tiny images are declined', () => {
    assert.equal(segment({ data: new Uint8ClampedArray(10 * 10 * 4), width: 10, height: 10 }).ok, false);
  });

  test('rendering crops to the garment, caps the size and writes the alpha channel', () => {
    const { img } = make(1200, 1200, white, (x, y) => tee([28, 44, 90])(x / 3, y / 3));
    const seg = segment(img);
    assert.equal(seg.ok, true);
    const out = renderCutout(img, seg, { maxSide: 600 });
    assert.ok(Math.max(out.width, out.height) <= 600);
    assert.ok(out.width < 1200 && out.height < 1200, 'should be cropped');
    assert.equal(out.data[3], 0, 'corner should be transparent');
    const mid = (Math.floor(out.height / 2) * out.width + Math.floor(out.width / 2)) * 4;
    assert.equal(out.data[mid + 3], 255, 'centre should be opaque');
    // colour sampled from the cut-out ignores the transparent backdrop
    const hex = dominantColor(out.data, out.width, out.height);
    assert.ok(hex, 'dominant colour');
    const r = parseInt(hex.slice(1, 3), 16);
    assert.ok(r < 70, `dominant colour should be the navy garment, got ${hex}`);
  });

  test('large photos segment quickly', () => {
    const { img } = make(2000, 1500, white, (x, y) => tee([28, 44, 90])(x / 5, y / 3.75));
    const t0 = performance.now();
    const seg = segment(img);
    assert.equal(seg.ok, true);
    assert.ok(performance.now() - t0 < 2500, `took ${Math.round(performance.now() - t0)}ms`);
  });

  test('Lab conversion matches known reference values', () => {
    const [L] = rgbToLab(255, 255, 255);
    assert.ok(Math.abs(L - 100) < 0.5);
    const [l2, a2] = rgbToLab(255, 0, 0);
    assert.ok(Math.abs(l2 - 53.2) < 1 && a2 > 70);
  });
});
