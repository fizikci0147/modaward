/**
 * Pure helpers for the "Touch up" editor, which lets a person fix a cut-out by hand: erase, restore, or tap a
 * patch of backdrop to erase everything around it that is the same colour. The mask is one byte per pixel
 * (0 = removed, 255 = kept) at the editor's image size. No DOM here, so it is tested in Node.
 */
import { segment, rgbToLab } from './cutout.js';

const FEATHER = 1.5;

/** Set the mask to `value` (0 or 255) inside a disc, with a soft one-and-a-half-pixel edge. Returns the changed rectangle. */
export function paintDisc(mask, w, h, cx, cy, r, value) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const cover = Math.max(0, Math.min(1, (r - d) / FEATHER + 0.5));
      if (cover <= 0) continue;
      const i = y * w + x;
      mask[i] = value === 0 ? Math.round(mask[i] * (1 - cover)) : Math.round(mask[i] + (255 - mask[i]) * cover);
    }
  }
  return { x: x0, y: y0, w: Math.max(0, x1 - x0 + 1), h: Math.max(0, y1 - y0 + 1) };
}

/** Paint along a stroke from (x0,y0) to (x1,y1). Returns the changed rectangle. */
export function paintLine(mask, w, h, x0, y0, x1, y1, r, value) {
  const step = Math.max(1, r / 3);
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
  let box = null;
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const b = paintDisc(mask, w, h, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, r, value);
    if (!box) box = b;
    else {
      const nx = Math.min(box.x, b.x);
      const ny = Math.min(box.y, b.y);
      box = { x: nx, y: ny, w: Math.max(box.x + box.w, b.x + b.w) - nx, h: Math.max(box.y + box.h, b.y + b.h) - ny };
    }
  }
  return box;
}

/**
 * Tap a patch of backdrop: erase every connected pixel whose colour is within `tolerance` (Lab distance) of the
 * colour under the tap, without spreading through anything already erased. Returns the changed rectangle, or null if nothing changed.
 */
export function eraseSimilar(img, mask, x, y, tolerance) {
  const { data, width: w, height: h } = img;
  const sx = Math.max(0, Math.min(w - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(y)));
  let r = 0;
  let g = 0;
  let b = 0;
  let k = 0;
  for (let j = Math.max(0, sy - 2); j <= Math.min(h - 1, sy + 2); j++) {
    for (let i = Math.max(0, sx - 2); i <= Math.min(w - 1, sx + 2); i++) {
      const p = (j * w + i) * 4;
      r += data[p];
      g += data[p + 1];
      b += data[p + 2];
      k += 1;
    }
  }
  const seed = rgbToLab(r / k, g / k, b / k);
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  const near = (i) => {
    if (mask[i] === 0) return false; // what is already erased neither counts nor lets the patch spread past it
    const p = i * 4;
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    return Math.hypot(lab[0] - seed[0], lab[1] - seed[1], lab[2] - seed[2]) <= tolerance;
  };
  const start = sy * w + sx;
  if (!near(start)) return null;
  seen[start] = 1;
  stack[top++] = start;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let changed = 0;
  const visit = (i) => {
    if (!seen[i] && near(i)) {
      seen[i] = 1;
      stack[top++] = i;
    }
  };
  while (top) {
    const p = stack[--top];
    const px = p % w;
    const py = (p - px) / w;
    if (mask[p] !== 0) {
      mask[p] = 0;
      changed += 1;
    }
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    if (px > 0) visit(p - 1);
    if (px < w - 1) visit(p + 1);
    if (py > 0) visit(p - w);
    if (py < h - 1) visit(p + w);
  }
  if (!changed) return null;
  // The faint rim the automatic cut-out left around a piece belongs to the patch that was just erased: take it too,
  // two pixels deep, so no thin outline is left behind.
  const gone = new Uint8Array(seen);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(gone);
    for (let j = Math.max(0, minY - 3); j <= Math.min(h - 1, maxY + 3); j++) {
      for (let i = Math.max(0, minX - 3); i <= Math.min(w - 1, maxX + 3); i++) {
        const p = j * w + i;
        if (gone[p] || mask[p] === 0 || mask[p] >= 255) continue;
        if ((i > 0 && gone[p - 1]) || (i < w - 1 && gone[p + 1]) || (j > 0 && gone[p - w]) || (j < h - 1 && gone[p + w])) {
          next[p] = 1;
          mask[p] = 0;
        }
      }
    }
    gone.set(next);
  }
  // a soft edge where the erased patch meets what stays
  for (let j = Math.max(0, minY - 1); j <= Math.min(h - 1, maxY + 1); j++) {
    for (let i = Math.max(0, minX - 1); i <= Math.min(w - 1, maxX + 1); i++) {
      const p = j * w + i;
      if (seen[p] || mask[p] < 200) continue;
      if ((i > 0 && seen[p - 1]) || (i < w - 1 && seen[p + 1]) || (j > 0 && seen[p - w]) || (j < h - 1 && seen[p + w])) mask[p] = 170;
    }
  }
  const x0 = Math.max(0, minX - 3);
  const y0 = Math.max(0, minY - 3);
  return { x: x0, y: y0, w: Math.min(w - 1, maxX + 3) - x0 + 1, h: Math.min(h - 1, maxY + 3) - y0 + 1 };
}

/** The automatic cut-out as an editable mask the size of `img`, or all-kept when the automatic one refused. */
export function initialMask(img) {
  const { width: w, height: h } = img;
  const mask = new Uint8Array(w * h).fill(255);
  const seg = segment(img);
  if (!seg.ok) return { mask, auto: false, reason: seg.reason };
  const { mask: m, width: mw, height: mh } = seg;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(mh - 1, Math.max(0, ((y + 0.5) / h) * mh - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(mh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(mw - 1, Math.max(0, ((x + 0.5) / w) * mw - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(mw - 1, x0 + 1);
      const tx = fx - x0;
      const v = (m[y0 * mw + x0] * (1 - tx) + m[y0 * mw + x1] * tx) * (1 - ty) + (m[y1 * mw + x0] * (1 - tx) + m[y1 * mw + x1] * tx) * ty;
      mask[y * w + x] = Math.round(v * 255);
    }
  }
  return { mask, auto: true };
}

/**
 * Crop to what is kept (with a little room around it), cap the size, and write the mask as the alpha channel.
 * @returns {{data: Uint8ClampedArray, width: number, height: number}|null} null when nothing is kept
 */
export function applyMask(img, mask, { pad = 0.05, maxSide = 900 } = {}) {
  const { data, width: w, height: h } = img;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (maxX - minX + 1) * (maxY - minY + 1) < 0.003 * w * h) return null;
  const room = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * pad);
  const x0 = Math.max(0, minX - room);
  const y0 = Math.max(0, minY - room);
  const cw = Math.min(w, maxX + 1 + room) - x0;
  const ch = Math.min(h, maxY + 1 + room) - y0;
  const scale = Math.min(1, maxSide / Math.max(cw, ch));
  const ow = Math.max(1, Math.round(cw * scale));
  const oh = Math.max(1, Math.round(ch * scale));
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    const sy = Math.min(h - 1, y0 + Math.floor((y / oh) * ch));
    for (let x = 0; x < ow; x++) {
      const sx = Math.min(w - 1, x0 + Math.floor((x / ow) * cw));
      const i = (sy * w + sx) * 4;
      const o = (y * ow + x) * 4;
      out[o] = data[i];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i + 2];
      out[o + 3] = mask[sy * w + sx];
    }
  }
  return { data: out, width: ow, height: oh };
}
