/**
 * The catalogue look: a garment photographed once, in light cloth, becomes a "shading map" (where the folds, seams and
 * highlights are). Any colour and any fabric from fabrics.js can then be laid over it, so the result keeps the way real
 * cloth hangs and catches light while the colour and pattern are the person's. No model, no network.
 *
 * A template is an RGBA buffer: the red, green and blue bytes are the shade (128 means "neutral", more is lit, less is in
 * shadow), the alpha is the garment's shape.
 */
import { fabricById } from './fabrics.js';
import { hexToRgb, hexToHsl, isHex } from './color.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const LUT_N = 4096;
const FROM_LINEAR = new Uint8ClampedArray(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) {
  const c = i / LUT_N;
  FROM_LINEAR[i] = Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
}
const toSrgb = (lin) => FROM_LINEAR[Math.min(LUT_N, Math.max(0, Math.round(lin * LUT_N)))];

function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Companion colours for a pattern when the person only picked one: a deeper or lighter tone of the same hue, and an
 * accent a little round the colour wheel. They can always be changed.
 */
export function autoColours(main, tonal = false) {
  const hex = isHex(main) ? main : '#808080';
  const { h, s, l } = hexToHsl(hex);
  const light = l > 0.55;
  if (tonal) {
    // a faded or deeper version of the same cloth: what denim, heather and linen do
    return [hex, hslToHex(h, s * 0.8, light ? Math.max(0.05, l - 0.2) : Math.min(0.95, l + 0.24)), hex];
  }
  const second = hslToHex(h, Math.min(1, s * 0.9), light ? Math.max(0.12, l * 0.42) : Math.min(0.92, l + (1 - l) * 0.78));
  const third = hslToHex((h + 35) % 360, Math.min(1, Math.max(0.25, s)), light ? 0.4 : 0.66);
  return [hex, second, third];
}

function blurChannel(src, w, h, r) {
  // two box passes either way: a soft stand-in for a gaussian, fast enough for a 1000px image
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      const row = y * w;
      for (let x = -r; x <= r; x++) sum += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = sum / (2 * r + 1);
        sum += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum / (2 * r + 1);
        sum += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

function boundingBox(data, w, h) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Turn a photographed garment (RGBA cut-out, ideally plain and light) into a template.
 * Each pixel's brightness is divided by the garment's typical brightness, so the colour is taken out and only the
 * light and shadow stay.
 */
export function makeTemplate({ data, width, height }) {
  const out = new Uint8ClampedArray(width * height * 4);
  const lums = [];
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const l = 0.2126 * TO_LINEAR[data[o]] + 0.7152 * TO_LINEAR[data[o + 1]] + 0.0722 * TO_LINEAR[data[o + 2]];
    lum[i] = l;
    if (data[o + 3] > 200 && i % 7 === 0) lums.push(l);
  }
  lums.sort((a, b) => a - b);
  const ref = lums.length ? lums[Math.floor(lums.length * 0.55)] || 1e-3 : 1;
  // the photographed cloth's own weave, print and camera noise would otherwise be laid under the new fabric
  const mask = new Float32Array(width * height);
  const masked = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    mask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
    masked[i] = mask[i] * Math.min(2, lum[i] / ref);
  }
  const r = Math.max(1, Math.round(Math.max(width, height) * 0.004));
  const bm = blurChannel(masked, width, height, r);
  const bk = blurChannel(mask, width, height, r);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const v = mask[i] && bk[i] > 0.05 ? bm[i] / bk[i] : Math.min(2, lum[i] / ref);
    const s = Math.max(0, Math.min(255, Math.round(v * 128)));
    out[o] = out[o + 1] = out[o + 2] = s;
    out[o + 3] = data[o + 3];
  }
  return { data: out, width, height };
}

/**
 * Colour and fabric a template.
 * @param {{data: Uint8ClampedArray, width: number, height: number}} template
 * @param {object} [opts]
 * @param {string[]} [opts.colors]   up to three hex colours: main, second, third (missing ones are worked out)
 * @param {string} [opts.fabric]     a fabrics.js id
 * @param {number} [opts.scale]      1 is the fabric's natural size; 2 doubles it
 * @param {number} [opts.seed]       varies the random patterns
 * @param {number} [opts.widthUnits] how wide the garment is in real life, in centimetres (sets the pattern size)
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export function renderCatalogue(template, opts = {}) {
  const { width: w, height: h, data: src } = template;
  const fabric = fabricById(opts.fabric);
  const auto = autoColours(opts.colors?.[0], fabric.tonal);
  const cols = [0, 1, 2].map((i) => (i > 0 && fabric.tonal) || !isHex(opts.colors?.[i]) ? auto[i] : opts.colors[i]);
  const lin = cols.map((hex) => hexToRgb(hex).map((v) => TO_LINEAR[v]));
  const [m, c2, c3] = lin;
  const mainLum = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  const seed = opts.seed ?? 1;
  const scale = Math.max(0.2, Math.min(5, opts.scale ?? 1));
  const box = boundingBox(src, w, h);
  const k = (opts.widthUnits ?? 60) / box.w / scale; // cloth units in one pixel

  const patterned = fabric.colours > 1;
  const shade = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) shade[i] = src[i * 4] / 128;

  // fabric follows the folds: pattern coordinates are pushed along the slope of the soft shading
  let gx = null;
  let gy = null;
  if (patterned) {
    // blur only over the garment itself, so its outline does not look like a cliff to the fabric
    const mask = new Float32Array(w * h);
    const masked = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      mask[i] = src[i * 4 + 3] > 128 ? 1 : 0;
      masked[i] = mask[i] * shade[i];
    }
    const r = Math.max(2, Math.round(box.w * 0.014));
    const bm = blurChannel(masked, w, h, r);
    const bk = blurChannel(mask, w, h, r);
    const soft = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) soft[i] = bk[i] > 0.05 ? bm[i] / bk[i] : 1;
    gx = new Float32Array(w * h);
    gy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        gx[i] = (soft[i + 1] - soft[i - 1]) * 0.5;
        gy[i] = (soft[i + w] - soft[i - w]) * 0.5;
      }
    }
  }
  const warp = box.w * 0.22;
  const maxShift = box.w * 0.012;
  const shift = (v) => (v > maxShift ? maxShift : v < -maxShift ? -maxShift : v);

  const out = new Uint8ClampedArray(w * h * 4);
  const ctx = { aa: k * 1.1, seed };
  const grain = fabric.grain ?? 0.3;
  const sheen = 0.25 + (fabric.sheen ?? 0.2);
  // a dark cloth hides its folds in a straight multiply, so it also gets a gentle additive lift where light lands
  const darkLift = 0.06 * (1 - clamp01(mainLum * 6)) + 0.012;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const a = src[o + 3];
      if (a === 0) continue;
      let r = m[0];
      let g = m[1];
      let b = m[2];
      let relief = 1;
      if (patterned || fabric.tex) {
        const px = x + (gx ? shift(gx[i] * warp) : 0);
        const py = y + (gy ? shift(gy[i] * warp) : 0);
        const u = px * k;
        const v = py * k;
        if (patterned) {
          const [wb, wc] = fabric.fn(u, v, ctx);
          const B = clamp01(wb);
          const C = clamp01(wc);
          const keep = (1 - B) * (1 - C);
          const bw = B * (1 - C);
          r = m[0] * keep + c2[0] * bw + c3[0] * C;
          g = m[1] * keep + c2[1] * bw + c3[1] * C;
          b = m[2] * keep + c2[2] * bw + c3[2] * C;
        }
        if (fabric.tex) relief = fabric.tex(u, v);
      }
      // fine weave noise, a different value at every pixel but the same every time
      const n = ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)) >>> 0) / 4294967295;
      const s = shade[i] * relief * (1 + grain * 0.07 * (n - 0.5));
      const lift = s > 1 ? (s - 1) * sheen * darkLift * 4 : 0;
      out[o] = toSrgb(r * s + lift);
      out[o + 1] = toSrgb(g * s + lift);
      out[o + 2] = toSrgb(b * s + lift);
      out[o + 3] = a;
    }
  }
  return { data: out, width: w, height: h };
}
