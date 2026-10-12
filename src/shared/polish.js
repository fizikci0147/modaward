/**
 * "Studio finish" for a cut-out garment, with no model and no network: straighten a garment that was photographed a
 * little crooked, take the lumpy shading of wrinkles out of plain fabric (like a quick press), and even out light that
 * fell harder on one side. Colours and prints are left alone: only brightness is touched, and only the gentle,
 * wrinkle-sized variations in it.
 *
 * This is image processing, not a generative model: it makes a photo look cleaner and more like a catalogue shot, but
 * it cannot invent a person wearing the piece or re-drape fabric.
 */
import { rgbToLab } from './cutout.js';

const f3 = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
const unsrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** L*, a*, b* → 0-255 r, g, b */
function labToRgb(l, a, b, out, o) {
  const fy = (l + 16) / 116;
  const x = f3(fy + a / 500) * 0.95047;
  const y = f3(fy);
  const z = f3(fy - b / 200) * 1.08883;
  const r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const g = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  out[o] = clamp(Math.round(unsrgb(clamp(r, 0, 1))), 0, 255);
  out[o + 1] = clamp(Math.round(unsrgb(clamp(g, 0, 1))), 0, 255);
  out[o + 2] = clamp(Math.round(unsrgb(clamp(bl, 0, 1))), 0, 255);
}

/** A box blur of `src` weighted by `weight` (so pixels outside the garment do not bleed in), radius in pixels. */
function maskedBlur(src, weight, w, h, radius) {
  const n = w * h;
  const num = new Float32Array(n);
  const den = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    num[i] = src[i] * weight[i];
    den[i] = weight[i];
  }
  const box = (a) => {
    const tmp = new Float32Array(n);
    const out = new Float32Array(n);
    const size = 2 * radius + 1;
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -radius; x <= radius; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / size;
        acc += a[y * w + Math.min(w - 1, x + radius + 1)] - a[y * w + Math.max(0, x - radius)];
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
  };
  const a = box(num);
  const b = box(den);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b[i] > 1e-4 ? a[i] / b[i] : src[i];
  return out;
}

// ── straighten ────────────────────────────────────────────────────────────

/** A small binary copy of the garment: `side` cells across its longer edge, centred on its centre of mass. */
function smallMask(img, side = 96) {
  const { data, width: w, height: h } = img;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const span = Math.max(maxX - minX + 1, maxY - minY + 1);
  const scale = side / span;
  const g = Math.ceil(side * 1.5);
  const cells = new Uint8Array(g * g);
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * w + x) * 4 + 3] > 127) {
        sx += x;
        sy += y;
        count += 1;
      }
    }
  }
  const cx = sx / count;
  const cy = sy / count;
  for (let gy = 0; gy < g; gy++) {
    for (let gx = 0; gx < g; gx++) {
      const x = Math.round(cx + (gx - g / 2) / scale);
      const y = Math.round(cy + (gy - g / 2) / scale);
      if (x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 127) cells[gy * g + gx] = 1;
    }
  }
  return { cells, g, aspect: (maxY - minY + 1) / (maxX - minX + 1) };
}

/** How mirror-symmetric the mask is after turning it by `deg` degrees about its centre: 0 to 1. */
function symmetryAt({ cells, g }, deg) {
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const c = g / 2;
  const rot = new Uint8Array(g * g);
  for (let y = 0; y < g; y++) {
    for (let x = 0; x < g; x++) {
      // where this cell came from before the turn
      const sx = Math.round(c + (x - c) * cos + (y - c) * sin);
      const sy = Math.round(c - (x - c) * sin + (y - c) * cos);
      if (sx >= 0 && sy >= 0 && sx < g && sy < g && cells[sy * g + sx]) rot[y * g + x] = 1;
    }
  }
  let inter = 0;
  let union = 0;
  for (let y = 0; y < g; y++) {
    for (let x = 0; x < g; x++) {
      const a = rot[y * g + x];
      const b = rot[y * g + (g - 1 - x)];
      if (a && b) inter += 1;
      if (a || b) union += 1;
    }
  }
  return union ? inter / union : 0;
}

/**
 * The turn (in degrees, clockwise) that makes the garment most symmetric about a vertical line, or 0 when it is not a
 * clearly symmetric, upright piece or the gain is too small to be worth touching the photo.
 */
export function straightenAngle(img, { maxTilt = 14 } = {}) {
  const m = smallMask(img);
  if (!m || m.aspect < 0.85 || m.aspect > 2.2) return 0; // shoes and other things that lie sideways, and long thin pieces
  const base = symmetryAt(m, 0);
  if (base < 0.5) return 0; // not a symmetric garment
  let best = 0;
  let bestScore = base;
  for (let a = -maxTilt; a <= maxTilt; a += 1) {
    const s = symmetryAt(m, a);
    if (s > bestScore) ((bestScore = s), (best = a));
  }
  for (let a = best - 0.75; a <= best + 0.75; a += 0.25) {
    const s = symmetryAt(m, a);
    if (s > bestScore) ((bestScore = s), (best = a));
  }
  return Math.abs(best) >= 1.5 && bestScore - base >= 0.025 ? best : 0;
}

/** Turn an RGBA image by `deg` degrees (clockwise) on a canvas big enough to hold it; empty space stays transparent. */
export function rotateImage(img, deg) {
  const { data, width: w, height: h } = img;
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const W = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin));
  const H = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos));
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - W / 2;
      const dy = y - H / 2;
      // inverse map: where in the source does this output pixel come from
      const sx = dx * cos + dy * sin + w / 2;
      const sy = -dx * sin + dy * cos + h / 2;
      if (sx < -0.5 || sy < -0.5 || sx > w - 0.5 || sy > h - 0.5) continue;
      const x0 = clamp(Math.floor(sx), 0, w - 1);
      const y0 = clamp(Math.floor(sy), 0, h - 1);
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const fx = clamp(sx - x0, 0, 1);
      const fy = clamp(sy - y0, 0, 1);
      const idx = [(y0 * w + x0) * 4, (y0 * w + x1) * 4, (y1 * w + x0) * 4, (y1 * w + x1) * 4];
      const wt = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      // blend colour weighted by opacity, so the transparent surround does not darken the edge
      let a = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < 4; k++) {
        const al = data[idx[k] + 3] * wt[k];
        a += al;
        r += data[idx[k]] * al;
        g += data[idx[k] + 1] * al;
        b += data[idx[k] + 2] * al;
      }
      const o = (y * W + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
        out[o + 3] = a;
      }
    }
  }
  return { data: out, width: W, height: H };
}

/** Crop to the opaque part with a little room, so a turned image does not keep its empty corners. */
export function cropToContent(img, pad = 0.05) {
  const { data, width: w, height: h } = img;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return img;
  const room = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * pad);
  const x0 = Math.max(0, minX - room);
  const y0 = Math.max(0, minY - room);
  const cw = Math.min(w, maxX + 1 + room) - x0;
  const ch = Math.min(h, maxY + 1 + room) - y0;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) out.set(data.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + cw) * 4), y * cw * 4);
  return { data: out, width: cw, height: ch };
}

// ── press and even out the light ──────────────────────────────────────────

/**
 * Soften wrinkle-sized shading in plain fabric and remove a one-sided lighting slope. Only brightness changes; hue and
 * colourfulness stay, and strong contrast (stripes, prints, deep folds) is kept.
 * @param {{strength?: number, tilt?: number}} opts
 */
export function pressFabric(img, { strength = 0.85, tilt = 0.7 } = {}) {
  const { data, width: w, height: h } = img;
  const n = w * h;
  const span = Math.max(w, h);
  const L = new Float32Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  const weight = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lab = rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    L[i] = lab[0];
    A[i] = lab[1];
    B[i] = lab[2];
    weight[i] = data[i * 4 + 3] / 255 > 0.5 ? 1 : 0;
  }
  // keep the very edge out of the averages: it mixes in the old backdrop
  const low = maskedBlur(L, weight, w, h, Math.max(6, Math.round(span * 0.09)));
  const mid = maskedBlur(L, weight, w, h, Math.max(2, Math.round(span * 0.008)));

  // the lighting slope: a plane fitted to the slow brightness, mostly removed
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sl = 0;
  for (let i = 0; i < n; i++) {
    if (!weight[i]) continue;
    const x = (i % w) / span;
    const y = Math.floor(i / w) / span;
    sw += 1;
    sx += x;
    sy += y;
    sl += low[i];
  }
  const mx = sx / sw;
  const my = sy / sw;
  const ml = sl / sw;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxl = 0;
  let syl = 0;
  for (let i = 0; i < n; i++) {
    if (!weight[i]) continue;
    const x = (i % w) / span - mx;
    const y = Math.floor(i / w) / span - my;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    sxl += x * (low[i] - ml);
    syl += y * (low[i] - ml);
  }
  const det = sxx * syy - sxy * sxy || 1;
  const gx = (sxl * syy - syl * sxy) / det;
  const gy = (syl * sxx - sxl * sxy) / det;

  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < n; i++) {
    if (!weight[i]) continue;
    const x = (i % w) / span - mx;
    const y = Math.floor(i / w) / span - my;
    const slope = gx * x + gy * y;
    const m = mid[i] - low[i]; // wrinkle-sized shading
    const fine = L[i] - mid[i]; // the weave itself
    // gentle shading is damped; strong contrast (a print, a deep fold) passes through
    const calm = clamp(1 - Math.abs(m) / 22, 0, 1);
    const newL = low[i] - tilt * slope + m * (1 - strength * calm) + fine * (1 - 0.15 * strength);
    labToRgb(clamp(newL, 0, 100), A[i], B[i], out, i * 4);
  }
  return { data: out, width: w, height: h };
}

/**
 * The whole finish: straighten, then press. Returns the polished image and what was done.
 * @param {{data: Uint8ClampedArray, width: number, height: number}} img an RGBA cut-out (alpha is the garment)
 */
export function studioFinish(img, { straighten = true, press = true } = {}) {
  let out = img;
  let turned = 0;
  if (straighten) {
    turned = straightenAngle(out);
    if (turned) out = cropToContent(rotateImage(out, turned));
  }
  if (press) out = pressFabric(out);
  return { ...out, turned };
}
