/**
 * Garment background removal for photos taken on a fairly plain surface (bed, floor, table, wall).
 *
 * Pure functions over RGBA pixel arrays, so the same code runs in the browser (on canvas data)
 * and in Node (for tests). No dependencies, no network, nothing leaves the device.
 *
 * Method
 *  1. Work on a small copy (≤ 320px) for speed.
 *  2. Model the backdrop from the photo's border: cluster border pixels in CIE Lab (k ≤ 3).
 *  3. Score every pixel by how far it is from the nearest backdrop colour, relative to that
 *     backdrop's own spread. Darker-only differences (shadows) are discounted.
 *  4. Threshold adaptively (Otsu), flood-fill the backdrop inwards from the border, so interior
 *     details that merely resemble the backdrop (white buttons, light prints) stay in.
 *  5. Drop specks, fill pin-holes, keep the main garment(s), feather the edge.
 *  6. Self-check: refuse (rather than guess) when the result is implausible.
 */
import { L } from './i18n.js';


// ── colour ────────────────────────────────────────────────────────────────
const srgb = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

/** @returns {[number, number, number]} L*, a*, b* */
export function rgbToLab(r, g, b) {
  const R = srgb(r);
  const G = srgb(g);
  const B = srgb(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Colour distance that treats "darker, same hue" (a shadow) as only partly different. */
function distance(p, q) {
  const dL = p[0] - q[0];
  const da = p[1] - q[1];
  const db = p[2] - q[2];
  const l = dL < 0 ? dL * 0.5 : dL;
  return Math.sqrt(l * l + da * da + db * db);
}

// ── downscale ─────────────────────────────────────────────────────────────
function shrink(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  if (scale === 1) return { data: img.data, width: w, height: h };
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 4;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
          a += img.data[i + 3];
          n += 1;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = a / n;
    }
  }
  return { data: out, width: w, height: h };
}

// ── backdrop model ────────────────────────────────────────────────────────
function borderSamples(lab, w, h) {
  const band = Math.max(2, Math.round(0.035 * Math.min(w, h)));
  const samples = [];
  const take = (x, y) => samples.push(lab[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < band || y < band || x >= w - band || y >= h - band) take(x, y);
    }
  }
  return samples;
}

/** k-means (k ≤ 3) with farthest-point initialisation. */
function backdropClusters(samples) {
  const med = [0, 1, 2].map((c) => samples.map((s) => s[c]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]);
  const centers = [med];
  for (let k = 1; k < 3; k++) {
    let far = null;
    let farD = 0;
    for (let i = 0; i < samples.length; i += 3) {
      const d = Math.min(...centers.map((c) => distance(samples[i], c)));
      if (d > farD) {
        farD = d;
        far = samples[i];
      }
    }
    if (!far || farD < 10) break; // already one tight colour
    centers.push([...far]);
  }
  let assign = new Int32Array(samples.length);
  for (let it = 0; it < 8; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < centers.length; k++) {
        const d = distance(samples[i], centers[k]);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      assign[i] = best;
      const s = sums[best];
      s[0] += samples[i][0];
      s[1] += samples[i][1];
      s[2] += samples[i][2];
      s[3] += 1;
    }
    sums.forEach((s, k) => {
      if (s[3]) centers[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  const clusters = centers.map((c, k) => {
    let n = 0;
    let spread = 0;
    for (let i = 0; i < samples.length; i++) {
      if (assign[i] === k) {
        n += 1;
        spread += distance(samples[i], c);
      }
    }
    return { color: c, weight: n / samples.length, spread: n ? spread / n : 0 };
  });
  // A cluster with a small share of the border is probably the garment crossing the frame (one
  // sleeve or hem can take ~20% of the ring); real two-tone backdrops split far more evenly.
  const kept = clusters.filter((c) => c.weight >= 0.24);
  return kept.length ? kept : [clusters.sort((a, b) => b.weight - a.weight)[0]];
}

function otsu(values, bins = 64, max = 8) {
  const hist = new Float64Array(bins);
  for (const v of values) hist[Math.min(bins - 1, Math.floor((Math.min(v, max) / max) * bins))] += 1;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += i * hist[i];
  let wB = 0;
  let sB = 0;
  let best = 0;
  let bestT = 0;
  for (let i = 0; i < bins; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += i * hist[i];
    const between = wB * wF * (sB / wB - (sum - sB) / wF) ** 2;
    if (between > best) {
      best = between;
      bestT = i;
    }
  }
  return ((bestT + 1) / bins) * max;
}

// ── connected components ──────────────────────────────────────────────────
/** Label 4-connected regions where `pred(i)` is true. Returns {labels, sizes}. */
function components(w, h, pred) {
  const labels = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const queue = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (labels[start] !== -1 || !pred(start)) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = id;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && labels[p - 1] === -1 && pred(p - 1)) ((labels[p - 1] = id), (queue[tail++] = p - 1));
      if (x < w - 1 && labels[p + 1] === -1 && pred(p + 1)) ((labels[p + 1] = id), (queue[tail++] = p + 1));
      if (y > 0 && labels[p - w] === -1 && pred(p - w)) ((labels[p - w] = id), (queue[tail++] = p - w));
      if (y < h - 1 && labels[p + w] === -1 && pred(p + w)) ((labels[p + w] = id), (queue[tail++] = p + w));
    }
    sizes.push(tail);
  }
  return { labels, sizes };
}

function boxBlur(src, w, h, radius) {
  const out = new Float32Array(w * h);
  const tmp = new Float32Array(w * h);
  const size = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / size;
      acc += src[y * w + Math.min(w - 1, x + radius + 1)] - src[y * w + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / size;
      acc += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
    }
  }
  return out;
}

const smoothstep = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Segment the garment.
 * @param {{data: Uint8ClampedArray|number[], width: number, height: number}} img RGBA
 * @param {{maxWork?: number}} [opts]
 * @returns {{ok: boolean, reason?: string, mask?: Float32Array, width?: number, height?: number, fgFraction: number, borderContact: number, alreadyTransparent?: boolean}}
 */
export function segment(img, { maxWork = 320 } = {}) {
  if (img.width < 24 || img.height < 24) return { ok: false, reason: 'too-small', fgFraction: 0, borderContact: 0 };
  const small = shrink(img, maxWork);
  const { width: w, height: h, data } = small;
  const n = w * h;

  // already a cut-out (transparent PNG)? trust its alpha
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 200) transparent += 1;
  if (transparent / n > 0.05) {
    const mask = new Float32Array(n);
    let fg = 0;
    for (let i = 0; i < n; i++) {
      mask[i] = data[i * 4 + 3] / 255;
      if (mask[i] > 0.5) fg += 1;
    }
    return { ok: fg / n > 0.03, reason: fg / n > 0.03 ? undefined : 'empty', mask, width: w, height: h, fgFraction: fg / n, borderContact: 0, alreadyTransparent: true };
  }

  const lab = new Array(n);
  for (let i = 0; i < n; i++) lab[i] = rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);

  const clusters = backdropClusters(borderSamples(lab, w, h));
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (const c of clusters) {
      const d = distance(lab[i], c.color) / Math.max(c.spread * 2.5, 7);
      if (d < best) best = d;
    }
    score[i] = best;
  }

  const T = Math.max(1.3, Math.min(4, otsu(score)));
  const bgLike = (i) => score[i] <= T;

  // flood the backdrop in from the border
  const bg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seed = (i) => {
    if (!bg[i] && bgLike(i)) {
      bg[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) (seed(x), seed((h - 1) * w + x));
  for (let y = 0; y < h; y++) (seed(y * w), seed(y * w + w - 1));
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < n - w) seed(p + w);
  }

  // large enclosed patches that clearly are backdrop (a bag handle's loop) are backdrop too
  const enclosed = components(w, h, (i) => !bg[i] && score[i] <= T * 0.55);
  enclosed.sizes.forEach((size, id) => {
    if (size > 0.02 * n) for (let i = 0; i < n; i++) if (enclosed.labels[i] === id) bg[i] = 1;
  });

  // keep the main garment(s); drop specks
  const fgParts = components(w, h, (i) => !bg[i]);
  if (!fgParts.sizes.length) return { ok: false, reason: 'nothing-found', fgFraction: 0, borderContact: 0 };
  const largest = Math.max(...fgParts.sizes);
  const keep = fgParts.sizes.map((s) => s >= largest * 0.15 && s > 0.004 * n);
  const fg = new Uint8Array(n);
  let fgCount = 0;
  for (let i = 0; i < n; i++) {
    if (fgParts.labels[i] >= 0 && keep[fgParts.labels[i]]) {
      fg[i] = 1;
      fgCount += 1;
    }
  }
  // fill pin-holes (small gaps inside the garment)
  const holes = components(w, h, (i) => !fg[i]);
  holes.sizes.forEach((size, id) => {
    if (size < 0.003 * n) {
      for (let i = 0; i < n; i++) if (holes.labels[i] === id) ((fg[i] = 1), (fgCount += 1));
    }
  });

  // does the result look plausible?
  let borderFg = 0;
  let borderTotal = 0;
  const touch = (i) => {
    borderTotal += 1;
    if (fg[i]) borderFg += 1;
  };
  for (let x = 0; x < w; x++) (touch(x), touch((h - 1) * w + x));
  for (let y = 0; y < h; y++) (touch(y * w), touch(y * w + w - 1));
  const fgFraction = fgCount / n;
  const borderContact = borderFg / borderTotal;
  if (fgFraction < 0.04) return { ok: false, reason: 'low-contrast', fgFraction, borderContact };
  if (fgFraction > 0.88) return { ok: false, reason: 'no-clear-backdrop', fgFraction, borderContact };
  if (borderContact > 0.45) return { ok: false, reason: 'cluttered', fgFraction, borderContact };

  // feather the edge
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = fg[i];
  const soft = boxBlur(boxBlur(raw, w, h, 1), w, h, 1);
  const mask = new Float32Array(n);
  for (let i = 0; i < n; i++) mask[i] = smoothstep(0.3, 0.7, soft[i]);

  return { ok: true, mask, width: w, height: h, fgFraction, borderContact };
}

/**
 * Apply a segmentation to the full-resolution image: bilinear-upsample the mask, write it as the
 * alpha channel, crop to the garment with padding, and cap the output size.
 *
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export function renderCutout(img, seg, { pad = 0.05, maxSide = 900 } = {}) {
  const { mask, width: mw, height: mh } = seg;
  const sample = (u, v) => {
    const x = Math.min(mw - 1, Math.max(0, u * mw - 0.5));
    const y = Math.min(mh - 1, Math.max(0, v * mh - 0.5));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(mw - 1, x0 + 1);
    const y1 = Math.min(mh - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    return (mask[y0 * mw + x0] * (1 - fx) + mask[y0 * mw + x1] * fx) * (1 - fy) + (mask[y1 * mw + x0] * (1 - fx) + mask[y1 * mw + x1] * fx) * fy;
  };

  // bounding box in mask space
  let minX = mw;
  let minY = mh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      if (mask[y * mw + x] > 0.5) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bw = (maxX - minX + 1) / mw;
  const bh = (maxY - minY + 1) / mh;
  const padX = Math.max(bw, bh) * pad;
  const left = Math.max(0, minX / mw - padX);
  const top = Math.max(0, minY / mh - padX);
  const right = Math.min(1, (maxX + 1) / mw + padX);
  const bottom = Math.min(1, (maxY + 1) / mh + padX);

  const srcX0 = Math.floor(left * img.width);
  const srcY0 = Math.floor(top * img.height);
  const srcW = Math.max(1, Math.ceil((right - left) * img.width));
  const srcH = Math.max(1, Math.ceil((bottom - top) * img.height));
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const sy = Math.min(img.height - 1, srcY0 + Math.floor((y / outH) * srcH));
    for (let x = 0; x < outW; x++) {
      const sx = Math.min(img.width - 1, srcX0 + Math.floor((x / outW) * srcW));
      const i = (sy * img.width + sx) * 4;
      const o = (y * outW + x) * 4;
      const a = sample((sx + 0.5) / img.width, (sy + 0.5) / img.height);
      out[o] = img.data[i];
      out[o + 1] = img.data[i + 1];
      out[o + 2] = img.data[i + 2];
      out[o + 3] = Math.round(a * 255);
    }
  }
  return { data: out, width: outW, height: outH };
}

export const CUTOUT_MESSAGES = {
  'low-contrast': L('The garment is too close in colour to what it’s lying on, so we kept your original photo. A contrasting surface works best.'),
  'no-clear-backdrop': L('We couldn’t find a clear backdrop in that photo, so we kept it as is.'),
  cluttered: L('The background is too busy to separate cleanly, so we kept your original photo.'),
  'too-small': L('That photo is too small to cut out.'),
  'nothing-found': L('We couldn’t find the garment in that photo, so we kept it as is.'),
  empty: L('We couldn’t find the garment in that photo, so we kept it as is.')
};
