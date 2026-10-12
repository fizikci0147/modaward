import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { segment, renderCutout, rgbToLab } from '../src/shared/cutout.js';
import { straightenAngle, rotateImage, cropToContent, pressFabric, studioFinish } from '../src/shared/polish.js';
import { scene } from './cutout/scenes.js';

/** A cut-out of one scene piece, ready for the finish. */
function cutoutOf({ shape, garment, wrinkles = 0.3, seed = 4, size = 600 }) {
  const { img } = scene({ backdrop: 'white sheet', shape, garment, seed, w: size, h: size, wrinkles });
  const seg = segment(img);
  assert.equal(seg.ok, true, `${shape} / ${garment}: ${seg.reason}`);
  return renderCutout(img, seg, { maxSide: size });
}

/** Mean and spread of brightness, and mean colour, well inside the garment. */
function stats({ data, width: w, height: h }) {
  const L = [];
  const A = [];
  const B = [];
  for (let y = 4; y < h - 4; y++) {
    for (let x = 4; x < w - 4; x++) {
      const solid = [[-4, 0], [4, 0], [0, -4], [0, 4], [0, 0]].every(([dx, dy]) => data[((y + dy) * w + x + dx) * 4 + 3] >= 250);
      if (!solid) continue;
      const lab = rgbToLab(data[(y * w + x) * 4], data[(y * w + x) * 4 + 1], data[(y * w + x) * 4 + 2]);
      L.push(lab[0]);
      A.push(lab[1]);
      B.push(lab[2]);
    }
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = (a) => Math.sqrt(mean(a.map((v) => (v - mean(a)) ** 2)));
  return { L: mean(L), Lsd: sd(L), a: mean(A), b: mean(B) };
}

describe('studio finish: straightening', () => {
  test('a garment photographed a little crooked is turned back, whichever way it leaned', () => {
    for (const shape of ['tee', 'dress', 'trousers', 'hoodie']) {
      const cut = cutoutOf({ shape, garment: 'red, solid', wrinkles: 0.1, size: 500 });
      for (const tilt of [3, -4, 6, -8, 11]) {
        const fix = straightenAngle(cropToContent(rotateImage(cut, tilt)));
        assert.ok(Math.abs(fix + tilt) <= 1.5, `${shape} tilted ${tilt}° was corrected by ${fix}°`);
      }
    }
  });

  test('an upright garment, and anything that lies sideways, is left alone', () => {
    for (const shape of ['tee', 'dress', 'trousers', 'hoodie']) assert.equal(straightenAngle(cutoutOf({ shape, garment: 'red, solid', wrinkles: 0.1, size: 500 })), 0, shape);
    const shoe = cutoutOf({ shape: 'shoe', garment: 'red, solid', wrinkles: 0.1, size: 500 });
    for (const tilt of [4, -7]) assert.equal(straightenAngle(cropToContent(rotateImage(shoe, tilt))), 0, 'shoes are not straightened');
  });

  test('turning keeps the colours and does not dirty the edge', () => {
    const cut = cutoutOf({ shape: 'tee', garment: 'light blue, solid', wrinkles: 0.1, size: 400 });
    const turned = cropToContent(rotateImage(cut, 7));
    const before = stats(cut);
    const after = stats(turned);
    assert.ok(Math.abs(before.a - after.a) < 1 && Math.abs(before.b - after.b) < 1);
    // every partly transparent edge pixel keeps the garment's own hue, not a darkened blend with the empty corner
    let worst = 0;
    for (let i = 0; i < turned.data.length; i += 4) {
      const a = turned.data[i + 3];
      if (a > 40 && a < 220) worst = Math.max(worst, Math.abs(rgbToLab(turned.data[i], turned.data[i + 1], turned.data[i + 2])[0] - before.L));
    }
    assert.ok(worst < 25, `edge brightness strayed by ${worst.toFixed(1)}`);
  });
});

describe('studio finish: pressing the fabric', () => {
  test('wrinkle shading in plain fabric is cut by a third or more, with the colour and average brightness unchanged', () => {
    for (const garment of ['light blue, solid', 'red, solid']) {
      const cut = cutoutOf({ shape: 'tee', garment });
      const pressed = pressFabric(cut);
      const before = stats(cut);
      const after = stats(pressed);
      assert.ok(after.Lsd <= before.Lsd * 0.72, `${garment}: shading ${before.Lsd.toFixed(2)} → ${after.Lsd.toFixed(2)}`);
      assert.ok(Math.abs(after.a - before.a) < 0.6 && Math.abs(after.b - before.b) < 0.6, `${garment}: colour moved`);
      assert.ok(Math.abs(after.L - before.L) < 1.5, `${garment}: brightness moved`);
    }
  });

  test('stripes and prints keep nearly all of their contrast', () => {
    const stripes = cutoutOf({ shape: 'tee', garment: 'navy and white stripes' });
    assert.ok(stats(pressFabric(stripes)).Lsd >= stats(stripes).Lsd * 0.93, 'stripes were flattened');
    const floral = cutoutOf({ shape: 'dress', garment: 'floral print' });
    assert.ok(stats(pressFabric(floral)).Lsd >= stats(floral).Lsd * 0.8, 'the print was flattened');
  });

  test('one-sided light is evened out', () => {
    const cut = cutoutOf({ shape: 'tee', garment: 'light blue, solid', wrinkles: 0.02 });
    // brighten the left half and darken the right, as light from one side would
    const lit = { ...cut, data: new Uint8ClampedArray(cut.data) };
    for (let y = 0; y < cut.height; y++) {
      for (let x = 0; x < cut.width; x++) {
        const k = 1.18 - (0.36 * x) / cut.width;
        for (let c = 0; c < 3; c++) lit.data[(y * cut.width + x) * 4 + c] = Math.min(255, lit.data[(y * cut.width + x) * 4 + c] * k);
      }
    }
    const slope = (img) => {
      const half = (side) => {
        const v = [];
        const mid = Math.floor(img.width / 2);
        for (let y = 0; y < img.height; y += 3) for (let x = side ? mid : 0; x < (side ? img.width : mid); x += 3) if (img.data[(y * img.width + x) * 4 + 3] > 250) v.push(rgbToLab(img.data[(y * img.width + x) * 4], img.data[(y * img.width + x) * 4 + 1], img.data[(y * img.width + x) * 4 + 2])[0]);
        return v.reduce((s, a) => s + a, 0) / v.length;
      };
      return Math.abs(half(0) - half(1));
    };
    assert.ok(slope(pressFabric(lit)) < slope(lit) * 0.6, `left-right difference ${slope(lit).toFixed(1)} → ${slope(pressFabric(lit)).toFixed(1)}`);
  });

  test('the shape and transparency are untouched, and it is quick', () => {
    const cut = cutoutOf({ shape: 'hoodie', garment: 'red, solid', size: 900 });
    const t0 = performance.now();
    const pressed = pressFabric(cut);
    assert.ok(performance.now() - t0 < 1500, `took ${Math.round(performance.now() - t0)}ms`);
    assert.equal(pressed.width, cut.width);
    for (let i = 3; i < cut.data.length; i += 4) if (pressed.data[i] !== cut.data[i]) assert.fail('alpha changed');
  });

  test('the whole finish reports a turn only when it turned something', () => {
    const cut = cutoutOf({ shape: 'tee', garment: 'red, solid', wrinkles: 0.1, size: 400 });
    assert.equal(studioFinish(cut).turned, 0);
    const crooked = cropToContent(rotateImage(cut, 6));
    const fin = studioFinish(crooked);
    assert.ok(Math.abs(fin.turned + 6) <= 1.5);
    assert.ok(fin.width > 0 && fin.height > 0);
  });
});
