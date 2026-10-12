/**
 * Synthetic "photos of clothes on a surface" for judging background removal. They are made up, so they cannot
 * stand in for real photos, but they carry the things that make real ones hard: textured and unevenly lit
 * backdrops, soft shadows, wrinkles, stripes and prints, garments close in colour to the surface, camera noise.
 */
import { rng } from '../../src/engine/rng.js';

const clamp = (v) => Math.max(0, Math.min(255, v));

/** Smooth value noise in [-1, 1] with the given feature size (px). */
function valueNoise(seed, size) {
  const r = rng(seed);
  const grid = new Map();
  const at = (i, j) => {
    const k = `${i},${j}`;
    if (!grid.has(k)) grid.set(k, r() * 2 - 1);
    return grid.get(k);
  };
  return (x, y) => {
    const gx = x / size;
    const gy = y / size;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const fx = gx - i;
    const fy = gy - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
    const b = at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx;
    return a * (1 - sy) + b * sy;
  };
}

export const BACKDROPS = {
  'white sheet': (seed) => {
    const n = valueNoise(seed, 90);
    return (x, y) => {
      const v = 244 + n(x, y) * 3;
      return [v, v, v - 2];
    };
  },
  'bed fabric': (seed) => {
    const lo = valueNoise(seed, 70);
    const mid = valueNoise(seed + 1, 14);
    const hi = valueNoise(seed + 2, 3);
    return (x, y) => {
      const v = 208 + lo(x, y) * 14 + mid(x, y) * 7 + hi(x, y) * 5;
      return [v + 4, v, v - 10];
    };
  },
  'wooden floor': (seed) => {
    const grain = valueNoise(seed, 5);
    const r = rng(seed + 9);
    const plank = Array.from({ length: 12 }, () => (r() - 0.5) * 34);
    return (x, y) => {
      const p = plank[Math.floor(x / 52) % plank.length];
      const stripe = Math.sin(y / 7 + grain(x * 0.15, y * 3) * 4) * 6;
      const base = 138 + p + stripe + grain(x, y) * 8;
      return [base + 46, base + 2, base - 46];
    };
  },
  carpet: (seed) => {
    const hi = valueNoise(seed, 2);
    const mid = valueNoise(seed + 1, 9);
    return (x, y) => {
      const v = 175 + hi(x, y) * 26 + mid(x, y) * 9;
      return [v + 10, v, v - 14];
    };
  },
  'uneven light': (seed) => {
    const n = valueNoise(seed, 40);
    return (x, y) => {
      const falloff = 1 - 0.38 * Math.hypot((x - 80) / 560, (y - 60) / 480);
      const v = 236 * falloff + n(x, y) * 4;
      return [v, v - 2, v - 8];
    };
  },
  'checked spread': (seed) => {
    const n = valueNoise(seed, 11);
    return (x, y) => {
      const check = (Math.floor(x / 34) + Math.floor(y / 34)) % 2;
      const v = (check ? 205 : 232) + n(x, y) * 5;
      return [v, v - 3, v - 14];
    };
  },
  concrete: (seed) => {
    const lo = valueNoise(seed, 60);
    const hi = valueNoise(seed + 3, 3);
    return (x, y) => {
      const v = 112 + lo(x, y) * 14 + hi(x, y) * 8;
      return [v, v + 1, v + 4];
    };
  }
};

/** Garment silhouettes in a 400x400 frame: return true inside. */
export const SHAPES = {
  tee: (x, y) => (x > 130 && x < 270 && y > 100 && y < 330) || (y > 100 && y < 190 && x > 70 && x < 330 && y < 190 - Math.max(0, (Math.abs(x - 200) - 100) * 0.0)),
  trousers: (x, y) => y > 70 && y < 350 && ((x > 130 && x < 195) || (x > 205 && x < 270) || (y < 130 && x > 130 && x < 270)),
  dress: (x, y) => {
    if (y < 60 || y > 360) return false;
    const half = 42 + Math.max(0, (y - 130) * 0.62);
    return Math.abs(x - 200) < Math.min(half, 125) && (y > 130 || Math.abs(x - 200) < 46);
  },
  hoodie: (x, y) => (x > 120 && x < 280 && y > 90 && y < 335) || (y > 110 && y < 300 && ((x > 62 && x < 125) || (x > 275 && x < 338))) || Math.hypot(x - 200, y - 92) < 52,
  shoe: (x, y) => {
    const sole = y > 235 && y < 268 && x > 70 && x < 335;
    const upper = Math.hypot((x - 175) / 1.5, (y - 215) * 1.25) < 78 && y < 240 && x > 80;
    return sole || upper;
  },
  bag: (x, y) => {
    if (x > 100 && x < 300 && y > 190 && y < 355) return true;
    const ring = Math.hypot(x - 200, y - 190);
    return y < 190 && ring < 88 && ring > 68;
  }
};

export const GARMENTS = {
  'navy, solid': { color: [28, 44, 90] },
  'red, solid': { color: [168, 38, 48] },
  'light blue, solid': { color: [150, 190, 230] },
  'cream on light (hard)': { color: [232, 224, 206] },
  'grey on grey (hard)': { color: [128, 128, 130] },
  'navy and white stripes': { color: [28, 44, 90], stripe: [240, 240, 238] },
  'floral print': { color: [60, 90, 70], dots: [[230, 190, 70], [215, 120, 130]] },
  'beige trench': { color: [196, 170, 130] }
};

/**
 * One scene.
 * @returns {{img:{data:Uint8ClampedArray,width:number,height:number}, truth:Uint8Array}}
 */
export function scene({ backdrop, shape, garment, seed = 1, w = 400, h = 400, shadow = true, noise = 4 }) {
  const back = BACKDROPS[backdrop](seed);
  const inside = SHAPES[shape];
  const g = GARMENTS[garment];
  const wrinkle = valueNoise(seed + 40, 26);
  const fine = valueNoise(seed + 41, 5);
  const r = rng(seed + 77);
  const dotAt = new Map();
  const dotColor = (x, y) => {
    const key = `${Math.floor(x / 22)},${Math.floor(y / 22)}`;
    if (!dotAt.has(key)) dotAt.set(key, r() < 0.45 ? Math.floor(r() * 2) : -1);
    return dotAt.get(key);
  };
  const data = new Uint8ClampedArray(w * h * 4);
  const truth = new Uint8Array(w * h);
  const noiseR = rng(seed + 123);
  // distance-to-garment is approximated by sampling the silhouette at an offset (a cheap soft shadow)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c;
      const inG = inside(x, y);
      if (inG) {
        let col = g.color;
        if (g.stripe && Math.floor(y / 14) % 2 === 0) col = g.stripe;
        if (g.dots) {
          const d = dotColor(x, y);
          if (d >= 0 && Math.hypot((x % 22) - 11, (y % 22) - 11) < 6) col = g.dots[d];
        }
        const shade = 1 + wrinkle(x, y) * 0.11 + fine(x, y) * 0.04;
        c = [col[0] * shade, col[1] * shade, col[2] * shade];
        truth[y * w + x] = 1;
      } else {
        c = back(x, y);
        if (shadow) {
          let s = 0;
          for (const [dx, dy] of [[-6, -8], [-12, -14], [-3, -4]]) if (inside(x + dx, y + dy)) s += 1;
          if (s) c = c.map((v) => v * (1 - 0.07 * s));
        }
      }
      const i = (y * w + x) * 4;
      data[i] = clamp(c[0] + (noiseR() - 0.5) * noise * 2);
      data[i + 1] = clamp(c[1] + (noiseR() - 0.5) * noise * 2);
      data[i + 2] = clamp(c[2] + (noiseR() - 0.5) * noise * 2);
      data[i + 3] = 255;
    }
  }
  return { img: { data, width: w, height: h }, truth };
}

/** Intersection-over-union of a segmentation's mask against the truth. */
export function iou(seg, truth, w, h) {
  let inter = 0;
  let union = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mx = Math.min(seg.width - 1, Math.floor((x / w) * seg.width));
      const my = Math.min(seg.height - 1, Math.floor((y / h) * seg.height));
      const m = seg.mask[my * seg.width + mx] > 0.5;
      const t = truth[y * w + x] === 1;
      if (m && t) inter += 1;
      if (m || t) union += 1;
    }
  }
  return inter / union;
}

/**
 * Several pieces lying apart on one surface.
 * @param {{shape:string, garment:string, ox:number, oy:number, scale:number}[]} parts position and size of each piece
 * @returns {{img:{data:Uint8ClampedArray,width:number,height:number}, truths:Uint8Array[]}} one truth mask per piece
 */
export function multiScene({ backdrop, parts, seed = 1, w = 600, h = 600, noise = 4 }) {
  const back = BACKDROPS[backdrop](seed);
  const wrinkle = valueNoise(seed + 40, 26);
  const noiseR = rng(seed + 123);
  const data = new Uint8ClampedArray(w * h * 4);
  const truths = parts.map(() => new Uint8Array(w * h));
  const inPart = (p, x, y) => SHAPES[p.shape]((x - p.ox) / p.scale, (y - p.oy) / p.scale);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = null;
      parts.forEach((p, k) => {
        if (c || !inPart(p, x, y)) return;
        const g = GARMENTS[p.garment];
        let col = g.color;
        if (g.stripe && Math.floor(y / 14) % 2 === 0) col = g.stripe;
        const shade = 1 + wrinkle(x, y) * 0.11;
        c = [col[0] * shade, col[1] * shade, col[2] * shade];
        truths[k][y * w + x] = 1;
      });
      if (!c) {
        c = back(x, y);
        let s = 0;
        for (const [dx, dy] of [[-6, -8], [-3, -4]]) if (parts.some((p) => inPart(p, x + dx, y + dy))) s += 1;
        if (s) c = c.map((v) => v * (1 - 0.07 * s));
      }
      const i = (y * w + x) * 4;
      data[i] = clamp(c[0] + (noiseR() - 0.5) * noise * 2);
      data[i + 1] = clamp(c[1] + (noiseR() - 0.5) * noise * 2);
      data[i + 2] = clamp(c[2] + (noiseR() - 0.5) * noise * 2);
      data[i + 3] = 255;
    }
  }
  return { img: { data, width: w, height: h }, truths };
}
