/**
 * Thermal comfort model.
 *
 * Each garment gets an insulation value (loosely modelled on "clo", the unit used in
 * clothing-comfort research). The sum for an outfit is compared against the insulation a
 * person needs at a given feels-like temperature. The knots below are calibrated so that:
 *   30°C  tee + shorts + sandals           ≈ 0.31
 *   21°C  tee + jeans + sneakers           ≈ 0.54
 *   10°C  sweater + jeans + jacket + shoes ≈ 1.16
 *    0°C  sweater + jeans + coat + boots + scarf + hat ≈ 1.6
 *  -10°C  heavy layers, parka, gloves       ≈ 2.3
 */

/** Underwear, socks and the like — everyone wears them. */
export const BASE_INSULATION = 0.15;

const REQUIRED = [
  [-20, 3.0],
  [-10, 2.3],
  [0, 1.6],
  [10, 1.15],
  [15, 0.9],
  [21, 0.5],
  [26, 0.34],
  [30, 0.26],
  [40, 0.18]
];

/** @param {number} feelsC apparent temperature in °C */
export function requiredInsulation(feelsC) {
  if (feelsC <= REQUIRED[0][0]) return REQUIRED[0][1];
  for (let i = 1; i < REQUIRED.length; i++) {
    const [t1, v1] = REQUIRED[i];
    if (feelsC <= t1) {
      const [t0, v0] = REQUIRED[i - 1];
      return v0 + ((v1 - v0) * (feelsC - t0)) / (t1 - t0);
    }
  }
  return REQUIRED[REQUIRED.length - 1][1];
}

// insulation by warmth rating 0…5 (index), per slot
const TABLE = {
  top: [0.04, 0.08, 0.15, 0.25, 0.35, 0.5],
  bottom: [0.04, 0.06, 0.15, 0.25, 0.32, 0.45],
  dress: [0.1, 0.18, 0.28, 0.35, 0.5, 0.6],
  outerwear: [0.05, 0.1, 0.2, 0.35, 0.55, 0.8],
  shoes: [0.01, 0.02, 0.04, 0.06, 0.1, 0.15],
  accessory: [0, 0.02, 0.05, 0.1, 0.15, 0.2]
};

/** @param {{category:string, warmth:number}} g */
export function garmentInsulation(g) {
  const table = TABLE[g.category] || TABLE.accessory;
  const w = Math.max(0, Math.min(5, g.warmth ?? 2));
  const lo = Math.floor(w);
  const hi = Math.ceil(w);
  return lo === hi ? table[lo] : table[lo] + (table[hi] - table[lo]) * (w - lo);
}

/** Layered second tops count a little less than a standalone piece (air gaps, thinner). */
const MID_LAYER_FACTOR = 0.85;

/**
 * @typedef {object} Parts
 * @property {object[]} upper    one top, or base + mid layer
 * @property {object|null} bottom
 * @property {object|null} dress
 * @property {object|null} outer
 * @property {object|null} shoes
 * @property {object[]} accessories
 */

/** Insulation of everything except the removable outer layer. */
export function insulationWithoutOuter(parts) {
  let total = BASE_INSULATION;
  parts.upper.forEach((g, i) => {
    total += garmentInsulation(g) * (i === 0 ? 1 : MID_LAYER_FACTOR);
  });
  if (parts.bottom) total += garmentInsulation(parts.bottom);
  if (parts.dress) total += garmentInsulation(parts.dress);
  if (parts.shoes) total += garmentInsulation(parts.shoes);
  for (const a of parts.accessories) total += garmentInsulation(a);
  return total;
}

export const outerInsulation = (parts) => (parts.outer ? garmentInsulation(parts.outer) : 0);

/**
 * Body regions cannot compensate for each other: a scarf does not warm bare legs. When the
 * lower body (or feet) carries far less insulation than the weather demands, comfort drops
 * no matter how much is worn on top.
 */
function regionFactor(parts, need) {
  const legs = parts.dress ? garmentInsulation(parts.dress) : parts.bottom ? garmentInsulation(parts.bottom) : 0.15;
  const feet = parts.shoes ? garmentInsulation(parts.shoes) : 0.04;
  const legDeficit = Math.max(0, 0.1 * need - legs);
  const footDeficit = Math.max(0, 0.05 * need - feet);
  return Math.exp(-((legDeficit / 0.05) ** 2)) * Math.exp(-((footDeficit / 0.06) ** 2));
}

/** At or above this feels-like temperature an outer layer is never worn (unless rain forces it). */
const OUTER_CUTOFF_C = 20;

/** Gaussian comfort curve, tighter on the cold side (being cold is worse than a bit warm). */
function comfort(delta, need) {
  const sigma = delta < 0 ? 0.13 + 0.05 * need : 0.19 + 0.08 * need;
  // a gentle linear tail keeps the curve informative when the closet cannot reach comfort,
  // so a nearly-adequate outfit still outranks a hopeless one
  const tail = Math.max(0, 1 - Math.abs(delta) / (need * 0.9));
  return 0.8 * Math.exp(-((delta / sigma) ** 2)) + 0.2 * tail;
}

/**
 * Score thermal comfort across the day. The outer layer is removable: for every hour we take
 * whichever of (with outer, without outer) is more comfortable, except when rain forces a
 * waterproof layer on.
 *
 * @param {Parts} parts
 * @param {{hours:{feels:number, rainProb:number}[]}} ctx
 * @returns {{score:number, outer:'always'|'sometimes'|'never'|'none', outerOnHours:number[], worst:number, deficit:number, excess:number}}
 */
export function thermalScore(parts, ctx) {
  const inner = insulationWithoutOuter(parts);
  const outer = outerInsulation(parts);
  const forceOn = parts.outer?.waterproof;
  let sum = 0;
  let worst = 1;
  let onCount = 0;
  let deficit = 0;
  let excess = 0;
  const outerOnHours = [];

  for (const h of ctx.hours) {
    const need = requiredInsulation(h.feels);
    const region = regionFactor(parts, need);
    const without = comfort(inner - need, need) * region;
    let best = without;
    let wearing = false;
    // nobody puts on a jacket when it is warm and dry
    const warmDry = h.feels >= OUTER_CUTOFF_C && !(forceOn && h.rainProb >= 50);
    if (outer > 0 && !warmDry) {
      const withOuter = comfort(inner + outer - need, need) * region;
      const mustWear = forceOn && h.rainProb >= 50;
      if (mustWear || withOuter > without) {
        best = withOuter;
        wearing = true;
      }
    }
    const worn = inner + (wearing ? outer : 0);
    deficit += Math.max(0, (need - worn) / need);
    excess += Math.max(0, (worn - need) / need);
    if (wearing) {
      onCount += 1;
      outerOnHours.push(h.hour);
    }
    sum += best;
    worst = Math.min(worst, best);
  }

  const n = Math.max(1, ctx.hours.length);
  let score = 0.7 * (sum / n) + 0.3 * worst;
  let mode = 'none';
  if (parts.outer) {
    mode = onCount === 0 ? 'never' : onCount === ctx.hours.length ? 'always' : 'sometimes';
    // carrying a coat you never need is a small nuisance
    if (mode === 'never') score -= 0.08;
  }
  return {
    score: Math.max(0, Math.min(1, score)),
    outer: mode,
    outerOnHours,
    worst,
    deficit: deficit / n,
    excess: excess / n
  };
}
