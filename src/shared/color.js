/**
 * Colour science for outfit harmony. Pure functions, no I/O, works in Node and the browser.
 */

const HEX_RE = /^#[0-9a-f]{6}$/i;

export const isHex = (v) => typeof v === 'string' && HEX_RE.test(v);

/** @param {string} hex @returns {[number, number, number]} */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** @returns {{h:number,s:number,l:number}} h in degrees 0–360, s and l in 0–1 */
export function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/** Smallest angular distance between two hues, 0–180. */
export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Named colour swatches. Used for the colour picker, quiz palette and retailer search keywords.
 * `role` says how the colour behaves in an outfit.
 */
export const PALETTE = Object.freeze([
  { name: 'black', hex: '#1c1c1e', role: 'neutral' },
  { name: 'charcoal', hex: '#3d3f44', role: 'neutral' },
  { name: 'grey', hex: '#8e9096', role: 'neutral' },
  { name: 'light grey', hex: '#cfd1d5', role: 'neutral' },
  { name: 'white', hex: '#f7f6f2', role: 'neutral' },
  { name: 'cream', hex: '#efe6d2', role: 'neutral' },
  { name: 'beige', hex: '#cdb89a', role: 'neutral' },
  { name: 'camel', hex: '#b58750', role: 'neutral' },
  { name: 'brown', hex: '#6b4a32', role: 'neutral' },
  { name: 'olive', hex: '#6b6f3a', role: 'earth' },
  { name: 'khaki', hex: '#a39a6a', role: 'neutral' },
  { name: 'navy', hex: '#1f2f54', role: 'neutral' },
  { name: 'denim', hex: '#4b6a93', role: 'neutral' },
  { name: 'light denim', hex: '#8fa9c8', role: 'neutral' },
  { name: 'forest green', hex: '#2f5a3e', role: 'accent' },
  { name: 'sage', hex: '#a1b49a', role: 'accent' },
  { name: 'teal', hex: '#2a7b83', role: 'accent' },
  { name: 'sky blue', hex: '#7fb4e0', role: 'accent' },
  { name: 'royal blue', hex: '#2d56c4', role: 'accent' },
  { name: 'lavender', hex: '#b2a4d4', role: 'accent' },
  { name: 'purple', hex: '#6a3f94', role: 'accent' },
  { name: 'burgundy', hex: '#6d1f35', role: 'accent' },
  { name: 'red', hex: '#c0302f', role: 'accent' },
  { name: 'rust', hex: '#b5532c', role: 'earth' },
  { name: 'orange', hex: '#e3772b', role: 'accent' },
  { name: 'mustard', hex: '#d4a017', role: 'earth' },
  { name: 'yellow', hex: '#f0cf4a', role: 'accent' },
  { name: 'blush', hex: '#e8b4b8', role: 'accent' },
  { name: 'pink', hex: '#e0709a', role: 'accent' }
]);

const SWATCH_BY_NAME = new Map(PALETTE.map((p) => [p.name, p]));
export const swatch = (name) => SWATCH_BY_NAME.get(name);

/** Perceptual-ish distance in RGB with channel weighting (redmean). */
function rgbDistance(a, b) {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** Closest named swatch for any hex colour. */
export function nearestSwatch(hex) {
  const rgb = hexToRgb(hex);
  let best = PALETTE[0];
  let bestD = Infinity;
  for (const p of PALETTE) {
    const d = rgbDistance(rgb, hexToRgb(p.hex));
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export const colorName = (hex) => nearestSwatch(hex).name;

/**
 * How a colour behaves in an outfit.
 *  - neutral: pairs with anything (black, white, greys, beiges, navy, denim, browns)
 *  - accent:  a deliberate colour that should be limited and harmonised
 * @param {string} hex
 */
export function colorRole(hex) {
  const { h, s, l } = hexToHsl(hex);
  if (l < 0.14 || l > 0.9 || s < 0.14) return 'neutral';
  // navy, denim and washed-out blues behave as neutrals (jeans go with everything)
  if (h >= 195 && h <= 250 && ((l < 0.5 && s < 0.65) || s < 0.45)) return 'neutral';
  // warm tans, camel, brown, khaki
  if (h >= 20 && h <= 55 && s < 0.62 && l < 0.94) return 'neutral';
  return 'accent';
}

/** True for the dark neutrals that can look "almost matching" when mixed. */
function darkNeutralFamily(hex) {
  const { h, s, l } = hexToHsl(hex);
  if (l < 0.16 && s < 0.2) return 'black';
  if (h >= 200 && h <= 250 && l < 0.3 && s >= 0.2) return 'navy';
  if (h >= 15 && h <= 40 && l < 0.35 && s >= 0.25) return 'brown';
  return null;
}

/**
 * Harmony of a set of garment colours, 0–1, with a human-readable note.
 * Rules follow how stylists actually build outfits: neutrals go with everything, one accent is
 * a feature, two accents must relate (analogous or complementary), three is chaos.
 *
 * @param {{hex:string, weight?:number}[]} colors weight lets shoes/accessories count for less
 * @returns {{score:number, note:string}}
 */
export function harmony(colors) {
  const items = colors.filter((c) => isHex(c.hex));
  if (items.length < 2) return { score: 0.85, note: '' };

  const accents = [];
  for (const c of items) if (colorRole(c.hex) === 'accent') accents.push(hexToHsl(c.hex));

  // cluster accent hues within 30° of each other
  const clusters = [];
  for (const a of accents) {
    const hit = clusters.find((c) => hueDistance(c.h, a.h) <= 30);
    if (hit) {
      hit.n += 1;
      hit.s = Math.max(hit.s, a.s);
    } else clusters.push({ h: a.h, s: a.s, n: 1 });
  }

  let score = 1;
  let note = '';
  if (clusters.length === 0) {
    score = 0.92;
    note = 'A calm, all-neutral palette';
  } else if (clusters.length === 1) {
    score = 1;
    note = 'One colour doing the talking, balanced by neutrals';
  } else if (clusters.length === 2) {
    const d = hueDistance(clusters[0].h, clusters[1].h);
    if (d <= 60) {
      score = 0.9;
      note = 'Analogous colours that sit side by side on the wheel';
    } else if (d >= 150) {
      score = 0.82;
      note = 'Complementary colours for a confident contrast';
    } else {
      score = 0.45;
      note = 'Two competing colours';
    }
    if (Math.min(clusters[0].s, clusters[1].s) > 0.7 && d > 60) score -= 0.12;
  } else {
    score = 0.28;
    note = 'Too many colours at once';
  }

  // dark neutral mismatch: navy + black, black + brown, navy + brown
  const families = new Set();
  for (const c of items) {
    const f = darkNeutralFamily(c.hex);
    if (f) families.add(f);
  }
  if (families.size >= 2) {
    score -= families.has('black') && families.has('brown') ? 0.18 : 0.1;
    note = note || 'Dark tones that almost, but not quite, match';
  }

  // tonal flatness: top and bottom nearly identical lightness AND different colours reads muddy
  const lightness = items.map((c) => hexToHsl(c.hex).l);
  const spread = Math.max(...lightness) - Math.min(...lightness);
  if (spread < 0.08 && clusters.length > 0) score -= 0.06;

  return { score: Math.max(0, Math.min(1, score)), note };
}

/**
 * Pick the dominant garment colour from raw RGBA pixels (e.g. a downsampled canvas).
 * Ignores near-transparent pixels and very bright, low-saturation backgrounds by weighting
 * central pixels more heavily — garment photos are typically centred on a plain backdrop.
 *
 * @param {Uint8ClampedArray|number[]} data RGBA
 * @param {number} width
 * @param {number} height
 * @returns {string|null} hex colour
 */
export function dominantColor(data, width, height) {
  const buckets = new Map();
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy) || 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      const centre = 1 - Math.hypot(x - cx, y - cy) / maxR; // 1 in the middle, 0 at corners
      const weight = 0.15 + centre * centre;
      const r = data[i] >> 4;
      const g = data[i + 1] >> 4;
      const b = data[i + 2] >> 4;
      const key = (r << 8) | (g << 4) | b;
      const bucket = buckets.get(key) || { w: 0, r: 0, g: 0, b: 0 };
      bucket.w += weight;
      bucket.r += data[i] * weight;
      bucket.g += data[i + 1] * weight;
      bucket.b += data[i + 2] * weight;
      buckets.set(key, bucket);
    }
  }
  let best = null;
  for (const b of buckets.values()) if (!best || b.w > best.w) best = b;
  return best ? rgbToHex(best.r / best.w, best.g / best.w, best.b / best.w) : null;
}
