import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FABRICS, FABRIC_GROUPS, FABRIC_IDS, fabricById } from '../src/shared/fabrics.js';
import { renderCatalogue, makeTemplate, autoColours } from '../src/shared/catalogue.js';
import { PATTERNS } from '../src/shared/taxonomy.js';
import { isHex, hexToRgb } from '../src/shared/color.js';
import { shirtTemplate } from './cutout/shirt-template.js';

const flat = (w = 120, h = 140, shade = 128) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 10; y < h - 10; y++) {
    for (let x = 10; x < w - 10; x++) {
      const o = (y * w + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = shade;
      data[o + 3] = 255;
    }
  }
  return { data, width: w, height: h };
};

function meanRgb({ data, width, height }) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] === 255) {
      r += data[i * 4];
      g += data[i * 4 + 1];
      b += data[i * 4 + 2];
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

describe('fabric library', () => {
  test('is large, with unique ids and every one grouped, labelled and mapped to a pattern the outfit engine knows', () => {
    assert.ok(FABRICS.length >= 50, `${FABRICS.length} fabrics`);
    assert.equal(new Set(FABRIC_IDS).size, FABRICS.length);
    for (const f of FABRICS) {
      assert.ok(FABRIC_GROUPS[f.group], `${f.id}: unknown group ${f.group}`);
      assert.ok(f.label.length > 1, f.id);
      assert.ok(PATTERNS.includes(f.category), `${f.id}: ${f.category}`);
      assert.ok([1, 2, 3].includes(f.colours), f.id);
      assert.ok(f.unit > 0, f.id);
    }
    for (const g of Object.keys(FABRIC_GROUPS)) assert.ok(FABRICS.some((f) => f.group === g), `empty group ${g}`);
  });

  test('every fabric answers with finite weights between 0 and 1, and unknown ids fall back to solid', () => {
    for (const f of FABRICS) {
      for (let i = 0; i < 400; i++) {
        const [b, c] = f.fn((i * 7.31) % 90 - 5, (i * 3.77) % 120 - 5, { aa: 0.1, seed: 5 });
        assert.ok(Number.isFinite(b) && Number.isFinite(c), `${f.id} gave ${b},${c}`);
        assert.ok(b >= -0.001 && b <= 1.001 && c >= -0.001 && c <= 1.001, `${f.id} out of range: ${b},${c}`);
      }
    }
    assert.equal(fabricById('nope').id, 'solid');
  });

  test('each patterned fabric really uses its second colour (and the three-colour ones the third)', () => {
    for (const f of FABRICS.filter((x) => x.colours > 1)) {
      let b = 0;
      let c = 0;
      for (let y = 0; y < 90; y += 0.7) {
        for (let x = 0; x < 70; x += 0.7) {
          const [wb, wc] = f.fn(x, y, { aa: 0.1, seed: 5 });
          if (wb > 0.2) b++;
          if (wc > 0.2) c++;
        }
      }
      assert.ok(b > 20, `${f.id}: second colour never shows`);
      if (f.colours === 3) assert.ok(c > 5, `${f.id}: third colour never shows`);
    }
  });
});

describe('catalogue renderer', () => {
  test('a solid colour on a neutral template comes out as that colour', () => {
    for (const hex of ['#2a4a8c', '#c0392b', '#f3efe6', '#101010', '#e8b84a']) {
      const out = renderCatalogue(flat(), { colors: [hex], fabric: 'solid' });
      const [r, g, b] = meanRgb(out);
      const [R, G, B] = hexToRgb(hex);
      assert.ok(Math.abs(r - R) < 6 && Math.abs(g - G) < 6 && Math.abs(b - B) < 6, `${hex} came out ${[r, g, b].map(Math.round)}`);
    }
  });

  test('the shape is kept exactly: nothing appears outside the garment, edges keep their softness', () => {
    const t = shirtTemplate(300, 350);
    const out = renderCatalogue(t, { colors: ['#336699'], fabric: 'polka' });
    for (let i = 0; i < t.width * t.height; i++) assert.equal(out.data[i * 4 + 3], t.data[i * 4 + 3]);
  });

  test('folds survive: light parts come out lighter than shadowed parts, in pale, mid and dark colours alike', () => {
    const w = 100;
    const h = 100;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const x = i % w;
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = x < 50 ? 80 : 170;
      data[i * 4 + 3] = 255;
    }
    for (const hex of ['#f0e6d2', '#3a6ea5', '#0c0c0c']) {
      const out = renderCatalogue({ data, width: w, height: h }, { colors: [hex], fabric: 'solid' });
      const dark = out.data[(50 * w + 20) * 4 + 1];
      const light = out.data[(50 * w + 80) * 4 + 1];
      assert.ok(light > dark, `${hex}: ${dark} vs ${light}`);
    }
  });

  test('is deterministic, and the seed changes random patterns', () => {
    const t = shirtTemplate(200, 240);
    const a = renderCatalogue(t, { colors: ['#222222', '#dddddd'], fabric: 'leopard', seed: 1 });
    const b = renderCatalogue(t, { colors: ['#222222', '#dddddd'], fabric: 'leopard', seed: 1 });
    const c = renderCatalogue(t, { colors: ['#222222', '#dddddd'], fabric: 'leopard', seed: 2 });
    assert.deepEqual(a.data, b.data);
    assert.notDeepEqual(a.data, c.data);
  });

  test('scale makes the pattern bigger: a doubled stripe has half as many stripes across', () => {
    const t = flat(400, 100);
    const count = (scale) => {
      const out = renderCatalogue(t, { colors: ['#000000', '#ffffff'], fabric: 'stripe', scale });
      let flips = 0;
      let prev = out.data[(50 * 400 + 20) * 4] > 128;
      for (let x = 21; x < 380; x++) {
        const cur = out.data[(50 * 400 + x) * 4] > 128;
        if (cur !== prev) flips++;
        prev = cur;
      }
      return flips;
    };
    const a = count(1);
    const b = count(2);
    assert.ok(a > 10 && Math.abs(b * 2 - a) <= 4, `${a} vs ${b}`);
  });

  test('tonal fabrics (denim, heather) stay in the family of the one colour chosen, whatever second colour is passed', () => {
    const t = flat();
    const [R, G, B] = hexToRgb('#3a5a9a');
    for (const id of ['denim', 'heather', 'linen']) {
      const out = renderCatalogue(t, { colors: ['#3a5a9a', '#ff0000'], fabric: id });
      const [r, g, b] = meanRgb(out);
      assert.ok(b > r && b > g, `${id} went off-hue: ${[r, g, b].map(Math.round)}`);
      assert.ok(Math.abs(r - R) < 70 && Math.abs(b - B) < 70, `${id}: ${[r, g, b].map(Math.round)}`);
    }
  });

  test('every fabric renders a full garment without breaking, and quickly', () => {
    const t = shirtTemplate(500, 600);
    const t0 = Date.now();
    for (const f of FABRICS) {
      const out = renderCatalogue(t, { colors: ['#334455', '#e0d8c8', '#aa3322'], fabric: f.id });
      let odd = 0;
      for (let i = 0; i < out.data.length; i += 4) if (out.data[i + 3] > 0 && out.data[i] + out.data[i + 1] + out.data[i + 2] === 0 && f.id !== 'solid') odd++;
      assert.ok(odd < 50, `${f.id}: ${odd} black holes`);
    }
    const per = (Date.now() - t0) / FABRICS.length;
    assert.ok(per < 400, `${per}ms a fabric at 500x600`);
  });

  test('bad input is tolerated: no colours, junk colours, wild scale', () => {
    const t = flat(60, 60);
    for (const opts of [{}, { colors: ['nope', 5, null] }, { scale: 1e9 }, { scale: -3 }, { fabric: 123 }]) {
      const out = renderCatalogue(t, opts);
      assert.equal(out.data.length, t.data.length);
      assert.ok(!out.data.some((v) => Number.isNaN(v)));
    }
  });
});

describe('templates from photographs', () => {
  test('a coloured garment becomes a template that, recoloured with its own colour, looks like the original', () => {
    const base = shirtTemplate(300, 350);
    const [R, G, B] = hexToRgb('#c9b79c');
    const photo = new Uint8ClampedArray(base.data);
    for (let i = 0; i < base.width * base.height; i++) {
      const s = base.data[i * 4] / 128;
      photo[i * 4] = Math.min(255, R * s);
      photo[i * 4 + 1] = Math.min(255, G * s);
      photo[i * 4 + 2] = Math.min(255, B * s);
    }
    const tpl = makeTemplate({ data: photo, width: base.width, height: base.height });
    const out = renderCatalogue(tpl, { colors: ['#c9b79c'], fabric: 'solid' });
    let diff = 0;
    let n = 0;
    for (let i = 0; i < base.width * base.height; i++) {
      if (photo[i * 4 + 3] === 255) {
        diff += Math.abs(out.data[i * 4] - photo[i * 4]) + Math.abs(out.data[i * 4 + 1] - photo[i * 4 + 1]);
        n += 2;
      }
    }
    assert.ok(diff / n < 22, `mean error ${(diff / n).toFixed(1)}`);
  });
});

describe('companion colours', () => {
  test('are valid, differ from the main colour, and are lighter for dark colours and deeper for light ones', () => {
    for (const hex of ['#101010', '#3a6ea5', '#f3efe6', '#e8b84a', '#c0392b']) {
      const [m, s, t] = autoColours(hex);
      assert.equal(m, hex);
      assert.ok(isHex(s) && isHex(t));
      assert.notEqual(s, hex);
    }
    const lum = (h) => hexToRgb(h).reduce((a, v) => a + v, 0);
    assert.ok(lum(autoColours('#101010')[1]) > lum('#101010'));
    assert.ok(lum(autoColours('#f3efe6')[1]) < lum('#f3efe6'));
    assert.ok(isHex(autoColours(undefined)[0]));
  });
});
