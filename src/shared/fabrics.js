/**
 * The fabric library: patterns that can be laid over a garment template (see catalogue.js).
 *
 * Each fabric is a small function of a point on the cloth. It answers "how much of the second and third colour is here":
 * `[b, c]`, both 0 to 1, the rest being the main colour. Coordinates are in cloth units (about a centimetre), so the
 * same pattern looks the same size on a T-shirt and on a coat, and `ctx.aa` is the size of one pixel in those units, used
 * to keep edges smooth. Nothing here depends on a model or the network.
 */
import { L } from './i18n.js';

const fract = (v) => v - Math.floor(v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a || 1e-9));
  return t * t * (3 - 2 * t);
};
/** 1 inside `duty` of each period, with soft edges `aa` wide. */
const stripe = (v, duty, aa) => {
  const f = fract(v);
  return sstep(0, aa, f) * (1 - sstep(duty, duty + aa, f));
};
const tri = (v) => Math.abs(fract(v) - 0.5) * 2;

function hash(ix, iy, seed = 0) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fract(x);
  const fy = fract(y);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x, y, seed) => vnoise(x, y, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, seed + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, seed + 13) * 0.15;

/**
 * A twill weave of dark and light yarns, one repeat across \`n\` yarns of each colour: 0 for a dark crossing, 1 for light.
 * With four of each and a 2/2 twill this is the houndstooth.
 */
function weave(x, y, n, over) {
  const period = n * 2;
  const i = Math.floor(fract(x) * period);
  const j = Math.floor(fract(y) * period);
  const warp = i < n ? 0 : 1;
  const weft = j < n ? 0 : 1;
  return (i + j) % (over * 2) < over ? warp : weft;
}

/** Distance from (x, y) to the segment (ax, ay)–(bx, by). */
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

/** A teardrop with a curled tail, pointing along +x, inside roughly the unit square: the paisley shape. */
function teardrop(x, y) {
  if (Math.hypot(x + 0.1, y) < 0.2) return true;
  const t = (x + 0.1) / 0.6;
  if (t <= 0 || t >= 1) return false;
  return Math.abs(y - 0.5 * (x + 0.1) * (x + 0.1) * 2) < 0.2 * (1 - t);
}

/** Nearest and second-nearest jittered feature points: a cellular pattern for spots, scales and rosettes. */
function cells(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let id = 0;
  let fx = 0;
  let fy = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const px = ix + i + 0.15 + hash(ix + i, iy + j, seed) * 0.7;
      const py = iy + j + 0.15 + hash(ix + i, iy + j, seed + 3) * 0.7;
      const d = Math.hypot(x - px, y - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash(ix + i, iy + j, seed + 5);
        fx = x - px;
        fy = y - py;
      } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id, fx, fy };
}

/**
 * @typedef {object} Fabric
 * @property {string} id
 * @property {string} label           English name (translated where shown)
 * @property {string} group           the picker section
 * @property {string} category        the coarse pattern the outfit engine understands (taxonomy PATTERNS)
 * @property {1|2|3} colours          how many colours it uses
 * @property {number} unit            the natural size of one repeat, in cloth units (the scale control multiplies it)
 * @property {boolean} [tonal]  its second colour is always a tone of the main one (denim, heather), so only one colour is asked for
 * @property {number} [grain]         strength of the woven or knitted fineness (0 to 1)
 * @property {(u: number, v: number) => number} [tex]  a multiplier for the cloth's own relief (ridges, stitches)
 * @property {number} [sheen]         how much fold highlights shine (0 to 1)
 * @property {(u: number, v: number, ctx: {aa: number, seed: number}) => [number, number]} fn
 */

const G = {
  plain: L('Plain and textured'),
  stripes: L('Stripes'),
  checks: L('Checks and plaids'),
  dots: L('Dots'),
  geo: L('Geometric'),
  floral: L('Florals and prints'),
  animal: L('Animal and nature'),
  art: L('Colour effects')
};
export const FABRIC_GROUPS = Object.freeze(G);

/** @type {Fabric[]} */
export const FABRICS = [
  // ── plain and textured ──
  { id: 'solid', label: L('Solid'), group: 'plain', category: 'solid', colours: 1, unit: 4, grain: 0.35, fn: () => [0, 0] },
  { id: 'heather', tonal: true, label: L('Heather'), group: 'plain', category: 'solid', colours: 2, unit: 0.5, grain: 0.3, fn: (u, v, c) => [clamp01((fbm(u * 3, v * 3, c.seed) - 0.5) * 1.6 + 0.35) * 0.55, 0] },
  { id: 'denim', tonal: true, label: L('Denim'), group: 'plain', category: 'textured', colours: 2, unit: 1, grain: 0.9, sheen: 0.1, fn: (u, v, c) => [clamp01(0.35 + 0.5 * tri(u * 6 + v * 6) * 0.5 + (fbm(u * 0.9, v * 0.9, c.seed) - 0.5) * 0.9) * 0.6, 0] },
  { id: 'chambray', tonal: true, label: L('Chambray'), group: 'plain', category: 'textured', colours: 2, unit: 1, grain: 0.7, fn: (u, v, c) => [clamp01((0.5 + 0.5 * Math.sin(u * 22) * Math.sin(v * 22)) * 0.35 + (fbm(u * 2, v * 2, c.seed) - 0.5) * 0.3), 0] },
  { id: 'corduroy', label: L('Corduroy'), group: 'plain', category: 'textured', colours: 1, unit: 1, grain: 0.5, tex: (u) => 1 + 0.16 * Math.sin(u * 25), fn: () => [0, 0] },
  { id: 'linen', tonal: true, label: L('Linen'), group: 'plain', category: 'textured', colours: 2, unit: 1, grain: 0.8, fn: (u, v, c) => [clamp01((vnoise(u * 1.5, v * 28, c.seed) * 0.6 + vnoise(u * 28, v * 1.5, c.seed + 4) * 0.6 - 0.45) * 1.2), 0] },
  { id: 'tweed', label: L('Tweed'), group: 'plain', category: 'textured', colours: 3, unit: 1, grain: 0.8, fn: (u, v, c) => { const n = hash(Math.floor(u * 7), Math.floor(v * 7), c.seed); return n < 0.18 ? [1, 0] : n > 0.84 ? [0, 1] : [0, 0]; } },
  { id: 'knit', label: L('Knit'), group: 'plain', category: 'textured', colours: 1, unit: 1, grain: 0.6, tex: (u, v) => { const x = fract(u * 1.6) - 0.5; const y = fract(v * 1.6 + Math.abs(x) * 0.9); return 0.9 + 0.2 * Math.sin(y * Math.PI) ** 2; }, fn: () => [0, 0] },
  { id: 'twill', tonal: true, label: L('Twill'), group: 'plain', category: 'textured', colours: 2, unit: 1, grain: 0.7, fn: (u, v) => [tri((u + v) * 5) * 0.3, 0] },
  { id: 'herringbone', tonal: true, label: L('Herringbone'), group: 'plain', category: 'textured', colours: 2, unit: 2, grain: 0.6, fn: (u, v, c) => { const col = Math.floor(u / 1.2); const fu = fract(u / 1.2); const f = fract(v / 1.2 + (col % 2 ? fu : 1 - fu)); return [stripe(f, 0.5, c.aa) * 0.7, 0]; } },
  { id: 'satin', label: L('Satin'), group: 'plain', category: 'solid', colours: 1, unit: 4, grain: 0.05, sheen: 0.9, fn: () => [0, 0] },

  // ── stripes ──
  { id: 'pinstripe', label: L('Pinstripe'), group: 'stripes', category: 'striped', colours: 2, unit: 0.9, grain: 0.4, fn: (u, v, c) => [stripe(u / 0.9, 0.09, c.aa / 0.9), 0] },
  { id: 'stripe', label: L('Stripe'), group: 'stripes', category: 'striped', colours: 2, unit: 1.6, grain: 0.4, fn: (u, v, c) => [stripe(u / 1.6, 0.5, c.aa / 1.6), 0] },
  { id: 'wide-stripe', label: L('Wide stripe'), group: 'stripes', category: 'striped', colours: 2, unit: 5, grain: 0.4, fn: (u, v, c) => [stripe(u / 5, 0.5, c.aa / 5), 0] },
  { id: 'breton', label: L('Breton stripe'), group: 'stripes', category: 'striped', colours: 2, unit: 3, grain: 0.5, fn: (u, v, c) => [stripe(v / 3, 0.5, c.aa / 3), 0] },
  { id: 'candy', label: L('Candy stripe'), group: 'stripes', category: 'striped', colours: 2, unit: 1.1, grain: 0.4, fn: (u, v, c) => [stripe(u / 1.1, 0.5, c.aa / 1.1), 0] },
  { id: 'bengal', label: L('Bengal stripe'), group: 'stripes', category: 'striped', colours: 2, unit: 1.3, grain: 0.4, fn: (u, v, c) => [stripe(u / 1.3, 0.32, c.aa / 1.3), 0] },
  { id: 'double-stripe', label: L('Double stripe'), group: 'stripes', category: 'striped', colours: 2, unit: 2.2, grain: 0.4, fn: (u, v, c) => { const f = fract(u / 2.2); return [Math.max(stripe(f, 0.12, c.aa / 2.2), stripe(f - 0.22, 0.12, c.aa / 2.2)), 0]; } },
  { id: 'multi-stripe', label: L('Multi-colour stripe'), group: 'stripes', category: 'striped', colours: 3, unit: 4, grain: 0.4, fn: (u, v, c) => { const f = fract(u / 4); return f < 0.34 ? [0, 0] : f < 0.67 ? [1, 0] : [0, 1]; } },
  { id: 'diagonal', label: L('Diagonal stripe'), group: 'stripes', category: 'striped', colours: 2, unit: 2, grain: 0.4, fn: (u, v, c) => [stripe((u + v) / 2.8, 0.45, c.aa / 2.8), 0] },
  { id: 'gradient-stripe', label: L('Fading stripe'), group: 'stripes', category: 'striped', colours: 2, unit: 1.8, grain: 0.4, fn: (u, v, c) => [stripe(u / 1.8, 0.5, c.aa / 1.8) * clamp01(0.25 + 0.75 * Math.sin(v * 0.12) ** 2), 0] },

  // ── checks and plaids ──
  { id: 'gingham', label: L('Gingham'), group: 'checks', category: 'checked', colours: 2, unit: 1.2, grain: 0.5, fn: (u, v, c) => { const a = stripe(u / 1.2, 0.5, c.aa / 1.2); const b = stripe(v / 1.2, 0.5, c.aa / 1.2); return [0.5 * (a + b) > 0.99 ? 1 : 0.5 * (a + b) * 0.9 + (a * b) * 0.1, 0]; } },
  { id: 'check-fine', label: L('Fine check'), group: 'checks', category: 'checked', colours: 2, unit: 0.8, grain: 0.5, fn: (u, v, c) => [Math.max(stripe(u / 0.8, 0.14, c.aa / 0.8), stripe(v / 0.8, 0.14, c.aa / 0.8)), 0] },
  { id: 'graph-check', label: L('Graph check'), group: 'checks', category: 'checked', colours: 2, unit: 2.4, grain: 0.5, fn: (u, v, c) => [Math.max(stripe(u / 2.4, 0.05, c.aa / 2.4), stripe(v / 2.4, 0.05, c.aa / 2.4)), 0] },
  { id: 'windowpane', label: L('Windowpane'), group: 'checks', category: 'checked', colours: 2, unit: 6, grain: 0.5, fn: (u, v, c) => [Math.max(stripe(u / 6, 0.025, c.aa / 6), stripe(v / 6, 0.025, c.aa / 6)), 0] },
  { id: 'tattersall', label: L('Tattersall'), group: 'checks', category: 'checked', colours: 3, unit: 4, grain: 0.5, fn: (u, v, c) => { const a = Math.max(stripe(u / 4, 0.04, c.aa / 4), stripe(v / 4, 0.04, c.aa / 4)); const b = Math.max(stripe(u / 4 - 0.5, 0.04, c.aa / 4), stripe(v / 4 - 0.5, 0.04, c.aa / 4)); return [a, b]; } },
  { id: 'buffalo', label: L('Buffalo check'), group: 'checks', category: 'checked', colours: 2, unit: 5, grain: 0.6, fn: (u, v, c) => { const a = stripe(u / 5, 0.5, c.aa / 5); const b = stripe(v / 5, 0.5, c.aa / 5); return [a * b + 0.5 * (a + b - 2 * a * b), 0]; } },
  { id: 'tartan', label: L('Tartan plaid'), group: 'checks', category: 'checked', colours: 3, unit: 8, grain: 0.7, fn: (u, v, c) => { const a = stripe(u / 8 - 0.05, 0.05, c.aa / 8); const b = stripe(v / 8 - 0.05, 0.05, c.aa / 8); const x = stripe(u / 8 - 0.3, 0.3, c.aa / 8); const y = stripe(v / 8 - 0.3, 0.3, c.aa / 8); return [x + y - x * y * 0.4 > 0 ? Math.min(1, (x + y) * 0.55) : 0, Math.max(a, b)]; } },
  { id: 'glen', label: L('Glen check'), group: 'checks', category: 'checked', colours: 3, unit: 6, grain: 0.7, fn: (u, v, c) => { const w = weave(u / 6, v / 6, 4, 2); return [w * 0.75, Math.max(stripe(u / 6 - 0.5, 0.035, c.aa / 6), stripe(v / 6 - 0.5, 0.035, c.aa / 6))]; } },
  { id: 'houndstooth', label: L('Houndstooth'), group: 'checks', category: 'checked', colours: 2, unit: 2.8, grain: 0.7, fn: (u, v) => [weave(u / 2.8, v / 2.8, 4, 2), 0] },
  { id: 'plaid-flannel', label: L('Flannel plaid'), group: 'checks', category: 'checked', colours: 3, unit: 10, grain: 0.8, fn: (u, v, c) => { const a = stripe(u / 10 - 0.1, 0.22, c.aa / 10); const b = stripe(v / 10 - 0.1, 0.22, c.aa / 10); const x = stripe(u / 10 - 0.55, 0.05, c.aa / 10); const y = stripe(v / 10 - 0.55, 0.05, c.aa / 10); return [Math.min(1, (a + b) * 0.55), Math.max(x, y)]; } },

  // ── dots ──
  { id: 'polka', label: L('Polka dot'), group: 'dots', category: 'dotted', colours: 2, unit: 2.6, grain: 0.4, fn: (u, v, c) => { const row = Math.floor(v / 2.6); const x = fract(u / 2.6 + (row % 2) * 0.5) - 0.5; const y = fract(v / 2.6) - 0.5; return [1 - sstep(0.2 - c.aa / 2.6, 0.2 + c.aa / 2.6, Math.hypot(x, y)), 0]; } },
  { id: 'pin-dot', label: L('Pin dot'), group: 'dots', category: 'dotted', colours: 2, unit: 1.1, grain: 0.4, fn: (u, v, c) => { const x = fract(u / 1.1) - 0.5; const y = fract(v / 1.1) - 0.5; return [1 - sstep(0.1 - c.aa / 1.1, 0.1 + c.aa / 1.1, Math.hypot(x, y)), 0]; } },
  { id: 'big-dot', label: L('Large dot'), group: 'dots', category: 'dotted', colours: 2, unit: 6, grain: 0.4, fn: (u, v, c) => { const row = Math.floor(v / 6); const x = fract(u / 6 + (row % 2) * 0.5) - 0.5; const y = fract(v / 6) - 0.5; return [1 - sstep(0.3 - c.aa / 6, 0.3 + c.aa / 6, Math.hypot(x, y)), 0]; } },
  { id: 'confetti', label: L('Confetti'), group: 'dots', category: 'dotted', colours: 3, unit: 3, grain: 0.4, fn: (u, v, c) => { const k = cells(u / 3, v / 3, c.seed); const r = 0.13 + k.id * 0.05; const inside = 1 - sstep(r - c.aa / 3, r + c.aa / 3, k.d1); return k.id < 0.5 ? [inside, 0] : [0, inside]; } },
  { id: 'spots', label: L('Scattered spots'), group: 'dots', category: 'dotted', colours: 2, unit: 2.6, grain: 0.4, fn: (u, v, c) => { const k = cells(u / 2.6, v / 2.6, c.seed + 11); const r = 0.1 + k.id * 0.18; return [1 - sstep(r - c.aa / 2.6, r + c.aa / 2.6, k.d1), 0]; } },

  // ── geometric ──
  { id: 'argyle', label: L('Argyle'), group: 'geo', category: 'graphic', colours: 3, unit: 8, grain: 0.6, fn: (u, v, c) => { const a = u / 8 + v / 12; const b = u / 8 - v / 12; const alt = (Math.floor(a) + Math.floor(b)) % 2 !== 0; const line = Math.abs(fract(a) - 0.5) < c.aa / 6 + 0.012 || Math.abs(fract(b) - 0.5) < c.aa / 6 + 0.012; return [alt ? 1 : 0, line ? 1 : 0]; } },
  { id: 'chevron', label: L('Chevron'), group: 'geo', category: 'graphic', colours: 2, unit: 4, grain: 0.5, fn: (u, v, c) => [stripe((v + Math.abs(fract(u / 8) - 0.5) * 8) / 4, 0.5, c.aa / 4), 0] },
  { id: 'diamond', label: L('Diamond'), group: 'geo', category: 'graphic', colours: 2, unit: 4, grain: 0.5, fn: (u, v, c) => { const x = fract(u / 4) - 0.5; const y = fract(v / 4) - 0.5; return [1 - sstep(0.24 - c.aa / 4, 0.24 + c.aa / 4, Math.abs(x) + Math.abs(y)), 0]; } },
  { id: 'squares', label: L('Squares'), group: 'geo', category: 'graphic', colours: 2, unit: 3, grain: 0.5, fn: (u, v, c) => { const x = Math.abs(fract(u / 3) - 0.5); const y = Math.abs(fract(v / 3) - 0.5); return [1 - sstep(0.22 - c.aa / 3, 0.22 + c.aa / 3, Math.max(x, y)), 0]; } },
  { id: 'mosaic', label: L('Mosaic'), group: 'geo', category: 'graphic', colours: 2, unit: 3, grain: 0.5, fn: (u, v, c) => { const k = cells(u / 3, v / 3, c.seed + 21); return [1 - sstep(0.04, 0.04 + c.aa / 3 * 2, k.d2 - k.d1), 0]; } },
  { id: 'waves', label: L('Waves'), group: 'geo', category: 'graphic', colours: 2, unit: 3, grain: 0.5, fn: (u, v, c) => [stripe((v + Math.sin(u * 0.9) * 0.9) / 3, 0.4, c.aa / 3), 0] },

  // ── florals and prints ──
  { id: 'ditsy', label: L('Ditsy floral'), group: 'floral', category: 'floral', colours: 3, unit: 3.2, grain: 0.5, fn: (u, v, c) => { const k = cells(u / 3.2, v / 3.2, c.seed + 31); const r = Math.hypot(k.fx, k.fy); const th = Math.atan2(k.fy, k.fx) + k.id * 6.28; const petal = 0.26 * (0.65 + 0.35 * Math.cos(5 * th)); const leaf = r < 0.3 && Math.cos(2 * th + 1) > 0.6 && r > 0.18; return [r < petal ? (r < 0.07 ? 0 : 1) : 0, r < 0.07 ? 1 : leaf ? 0.4 : 0]; } },
  { id: 'floral-large', label: L('Large floral'), group: 'floral', category: 'floral', colours: 3, unit: 9, grain: 0.5, fn: (u, v, c) => { const k = cells(u / 9, v / 9, c.seed + 41); const r = Math.hypot(k.fx, k.fy); const th = Math.atan2(k.fy, k.fx) + k.id * 6.28; const petal = 0.42 * (0.62 + 0.38 * Math.cos(6 * th)); return [r < petal ? (r < 0.1 ? 0 : 1) : 0, r < 0.1 ? 1 : Math.abs(r - 0.5) < 0.04 && Math.cos(3 * th) > 0.3 ? 0.4 : 0]; } },
  { id: 'paisley', label: L('Paisley'), group: 'floral', category: 'floral', colours: 3, unit: 7, grain: 0.6, fn: (u, v, c) => { const k = cells(u / 7, v / 7, c.seed + 51); const a = k.id * 6.28; const x = (k.fx * Math.cos(a) + k.fy * Math.sin(a)) * 1.5; const y = (-k.fx * Math.sin(a) + k.fy * Math.cos(a)) * 1.5; const out = teardrop(x, y); const inner = teardrop(x * 1.9 + 0.06, y * 1.9); const core = teardrop(x * 3.6 + 0.12, y * 3.6); return [out ? 1 : 0, out && inner && !core ? 1 : 0]; } },
  { id: 'tropical', label: L('Tropical leaves'), group: 'floral', category: 'floral', colours: 3, unit: 8, grain: 0.5, fn: (u, v, c) => { const k = cells(u / 8, v / 8, c.seed + 61); const a = k.id * 3.14; const x = k.fx * Math.cos(a) + k.fy * Math.sin(a); const y = -k.fx * Math.sin(a) + k.fy * Math.cos(a); const w = 0.17 * Math.sqrt(Math.max(0, 1 - (x / 0.5) ** 2)) * (0.6 + 0.4 * Math.abs(Math.cos(x * 22))); const inside = Math.abs(x) < 0.5 && Math.abs(y) < w; return [inside ? 1 : 0, Math.abs(x) < 0.5 && Math.abs(y) < 0.012 ? 1 : 0]; } },
  { id: 'toile', label: L('Cherries'), group: 'floral', category: 'floral', colours: 3, unit: 5, grain: 0.5, fn: (u, v, c) => { const k = cells(u / 5, v / 5, c.seed + 71); const x = k.fx; const y = k.fy; const cherry = Math.hypot(x + 0.11, y - 0.1) < 0.1 || Math.hypot(x - 0.11, y - 0.13) < 0.1; const stem = Math.min(segDist(x, y, -0.11, 0.0, 0.02, -0.2), segDist(x, y, 0.11, 0.03, 0.02, -0.2)) < 0.012; const leaf = Math.hypot((x - 0.08) / 0.1, (y + 0.2) / 0.04) < 1; return [cherry ? 1 : 0, stem || leaf ? 1 : 0]; } },

  // ── animal and nature ──
  { id: 'leopard', label: L('Leopard'), group: 'animal', category: 'animal', colours: 3, unit: 3.2, grain: 0.5, fn: (u, v, c) => { const k = cells(u / 3.2 + fbm(u * 0.2, v * 0.2, c.seed) * 0.4, v / 3.2, c.seed + 81); const ring = Math.abs(k.d1 - 0.2 * (0.7 + k.id * 0.6)) < 0.06 && k.id > 0.15; return [ring ? 1 : 0, k.d1 < 0.13 * (0.7 + k.id * 0.6) ? 1 : 0]; } },
  { id: 'zebra', label: L('Zebra'), group: 'animal', category: 'animal', colours: 2, unit: 3, grain: 0.5, fn: (u, v, c) => [sstep(0.0, 0.25, Math.sin((u + fbm(u * 0.12, v * 0.12, c.seed) * 14) * 1.3 + Math.sin(v * 0.4) * 1.5)), 0] },
  { id: 'snake', label: L('Snakeskin'), group: 'animal', category: 'animal', colours: 3, unit: 2.6, grain: 0.6, fn: (u, v, c) => { const k = cells(u / 2.6, v / 1.7, c.seed + 91); const edge = 1 - sstep(0.04, 0.1, k.d2 - k.d1); return [edge, k.id > 0.6 ? 0.8 : 0]; } },
  { id: 'cow', label: L('Cow print'), group: 'animal', category: 'animal', colours: 2, unit: 22, grain: 0.4, fn: (u, v, c) => [sstep(0.52, 0.55, fbm(u / 22, v / 22, c.seed + 101)) * 0 + (fbm(u / 11, v / 11, c.seed + 101) > 0.58 ? 1 : 0), 0] },
  { id: 'camo', label: L('Camouflage'), group: 'animal', category: 'graphic', colours: 3, unit: 14, grain: 0.7, fn: (u, v, c) => { const a = fbm(u / 9, v / 9, c.seed + 111); const b = fbm(u / 6 + 9, v / 6, c.seed + 121); return [a > 0.56 ? 1 : 0, b > 0.6 ? 1 : 0]; } },
  { id: 'tie-dye', label: L('Tie-dye'), group: 'animal', category: 'graphic', colours: 3, unit: 40, grain: 0.5, fn: (u, v, c) => { const cx = 30; const cy = 36; const r = Math.hypot(u - cx, v - cy); const th = Math.atan2(v - cy, u - cx); const s = 0.5 + 0.5 * Math.sin(r * 0.55 + th * 3 + fbm(u * 0.05, v * 0.05, c.seed) * 5); return [s > 0.5 ? sstep(0.5, 0.8, s) : 0, s < 0.5 ? sstep(0.5, 0.2, s) : 0]; } },

  // ── colour effects ──
  { id: 'ombre', label: L('Ombré'), group: 'art', category: 'graphic', colours: 2, unit: 80, grain: 0.4, fn: (u, v) => [clamp01(v / 70), 0] },
  { id: 'speckle', tonal: true, label: L('Speckled'), group: 'art', category: 'textured', colours: 2, unit: 0.5, grain: 0.5, fn: (u, v, c) => [hash(Math.floor(u * 5), Math.floor(v * 5), c.seed) > 0.93 ? 1 : 0, 0] },
  { id: 'washed', tonal: true, label: L('Washed and faded'), group: 'art', category: 'textured', colours: 2, unit: 20, grain: 0.7, fn: (u, v, c) => [clamp01((fbm(u / 8, v / 8, c.seed + 131) - 0.35) * 1.5) * 0.55, 0] }
];

const BY_ID = new Map(FABRICS.map((f) => [f.id, f]));
export const fabricById = (id) => BY_ID.get(id) ?? BY_ID.get('solid');
export const FABRIC_IDS = Object.freeze(FABRICS.map((f) => f.id));

export { hash, vnoise, fbm };

const SHOE_FABRICS = ['solid', 'satin', 'heather', 'denim', 'corduroy', 'knit', 'twill', 'leopard', 'snake', 'zebra', 'camo', 'stripe'];
const HARD_FABRICS = ['solid', 'satin', 'snake', 'leopard'];
const ONLY_SOLID = ['solid'];

/**
 * The fabrics that make sense on a garment type: a pattern fits a dress, a heather fits a sweater, a polka dot does not
 * fit a watch. Everything else gets the whole library.
 * @param {string} type  taxonomy type id
 * @param {string} [category]  taxonomy category id
 */
export function fabricsFor(type, category) {
  if (type === 'sunglasses' || type === 'watch') return ONLY_SOLID.map(fabricById);
  if (type === 'belt') return HARD_FABRICS.map(fabricById);
  if (category === 'shoes') return SHOE_FABRICS.map(fabricById);
  return FABRICS;
}
