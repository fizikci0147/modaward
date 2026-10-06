/**
 * Garment illustrations, drawn in code.
 *
 * Every garment is a small flat-lay SVG in a 100×100 box: a silhouette filled with the garment's
 * real colour, soft shading, an outline derived from that colour, and construction details
 * (collars, plackets, cuffs, stitching). Symmetric garments are authored as a right half and
 * mirrored. Patterns are clipped to the silhouette. No images, no external assets.
 *
 * Only presentation attributes are used (never style="…") so the strict CSP stays intact.
 */
import { hexToRgb, rgbToHex, hexToHsl } from '/shared/color.js';

const mix = (a, b, t) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
};
export const darken = (hex, t) => mix(hex, '#0d0c0a', t);
export const lighten = (hex, t) => mix(hex, '#ffffff', t);

const MIRROR = 'translate(100 0) scale(-1 1)';

/**
 * Each art: { half?: string[] (right half, mirrored), full?: string[] (drawn as is),
 *             detail?: (c) => string }  where c = { fill, dark, light, line, id }.
 * `clip` shapes are the union of half/full paths.
 */
const A = {};

// ── tops ────────────────────────────────────────────────────────────────
const NECK_CREW = (c) => `<path d="M38 11.5 Q50 27 62 11.5 Q50 19 38 11.5Z" fill="${c.dark}" opacity=".55"/>`;
const NECK_V = (c) => `<path d="M39 11.5 L50 33 L61 11.5 Q50 18 39 11.5Z" fill="${c.dark}" opacity=".5"/>`;
const HEM = (c, y = 84) => `<path d="M24 ${y} H76" stroke="${c.line}" stroke-width=".8" opacity=".45" stroke-dasharray="1.6 1.6"/>`;

A.tee = {
  half: ['M50 12.5 L61 11 L81 19 L95 36 L84 44 L77 37 L77 89 L50 89 Z'],
  detail: (c) => NECK_CREW(c) + HEM(c, 84) + `<path d="M77 37 Q79 40 84 44" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".4"/><path d="M23 37 Q21 40 16 44" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".4"/>`
};
A.tank = {
  half: ['M50 25 Q56 24 58 8 L65 8 Q66 30 74 43 L74 89 L50 89 Z'],
  detail: (c) => HEM(c, 84) + `<path d="M35 8 L42 8 Q50 28 58 8 L65 8" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".35"/>`
};
A.polo = {
  half: ['M50 12.5 L61 11 L81 19 L95 36 L84 44 L77 37 L77 89 L50 89 Z'],
  detail: (c) =>
    `<path d="M39 10 L50 29 L61 10 L67 16 L50 36 L33 16 Z" fill="${c.light}" opacity=".8"/><path d="M39 10 L50 29 L61 10" fill="none" stroke="${c.line}" stroke-width=".9" opacity=".6"/>` +
    `<path d="M50 29 V54" stroke="${c.line}" stroke-width=".9" opacity=".6"/><circle cx="52.3" cy="38" r="1.3" fill="${c.dark}"/><circle cx="52.3" cy="47" r="1.3" fill="${c.dark}"/>` +
    `<path d="M77 37 Q79 40 84 44" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".4"/><path d="M23 37 Q21 40 16 44" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".4"/>` +
    `<path d="M80 31 L90 38" stroke="${c.dark}" stroke-width="3" opacity=".25"/><path d="M20 31 L10 38" stroke="${c.dark}" stroke-width="3" opacity=".25"/>`
};
A.longsleeve = {
  half: ['M50 12.5 L61 11 L80 18 L94 70 L84 74 L76 47 L76 88 L50 88 Z'],
  detail: (c) => NECK_CREW(c) + HEM(c, 83) + `<path d="M94 70 L84 74" stroke="${c.dark}" stroke-width="3.2" opacity=".35"/><path d="M6 70 L16 74" stroke="${c.dark}" stroke-width="3.2" opacity=".35"/>`
};
A.shirt = {
  half: ['M50 12.5 L61 11 L80 18 L94 72 L84 76 L76 48 L76 90 L50 90 Z'],
  detail: (c) =>
    `<path d="M37 9 L50 32 L63 9 L68 14 L50 40 L32 14 Z" fill="${c.light}" opacity=".85"/><path d="M37 9 L50 32 L63 9 M32 14 L50 40 L68 14" fill="none" stroke="${c.line}" stroke-width=".9" opacity=".55"/>` +
    `<path d="M50 40 V90" stroke="${c.line}" stroke-width=".9" opacity=".55"/>` +
    [48, 58, 68, 78].map((y) => `<circle cx="52.2" cy="${y}" r="1.2" fill="${c.dark}" opacity=".8"/>`).join('') +
    `<path d="M94 72 L84 76 M6 72 L16 76" stroke="${c.dark}" stroke-width="3" opacity=".3"/>` +
    `<path d="M24 62 H34 V74 H24Z" fill="none" stroke="${c.line}" stroke-width=".8" opacity=".4"/>`
};
A.blouse = {
  half: ['M50 12.5 L61 11 L81 19 L93 42 L80 48 L75 40 Q77 66 79 90 L50 90 Z'],
  detail: (c) => NECK_V(c) + `<path d="M50 33 V90" stroke="${c.line}" stroke-width=".7" opacity=".4"/><circle cx="52" cy="46" r="1.1" fill="${c.dark}" opacity=".7"/><circle cx="52" cy="60" r="1.1" fill="${c.dark}" opacity=".7"/><circle cx="52" cy="74" r="1.1" fill="${c.dark}" opacity=".7"/>`
};
A.sweater = {
  half: ['M50 12.5 L61 11 L80 18 L94 70 L84 74 L76 47 L76 88 L50 88 Z'],
  detail: (c) =>
    `<path d="M38 11.5 Q50 29 62 11.5 Q50 21 38 11.5Z" fill="${c.dark}" opacity=".45"/>` +
    `<path d="M24 80 H76 V88 H24Z" fill="${c.dark}" opacity=".16"/>` +
    [28, 34, 40, 46, 52, 58, 64, 70].map((x) => `<path d="M${x} 80 V88" stroke="${c.line}" stroke-width=".6" opacity=".35"/>`).join('') +
    `<path d="M94 70 L84 74 L82 69 L92 65Z" fill="${c.dark}" opacity=".25"/><path d="M6 70 L16 74 L18 69 L8 65Z" fill="${c.dark}" opacity=".25"/>` +
    `<path d="M40 30 Q50 34 60 30 M38 40 Q50 44 62 40 M36 50 Q50 54 64 50" stroke="${c.line}" stroke-width=".6" fill="none" opacity=".18"/>`
};
A.cardigan = {
  half: ['M52 12.5 L61 11 L80 18 L94 70 L84 74 L76 47 L76 88 L52 88 Z'],
  detail: (c) =>
    `<path d="M45 13 H55 V88 H45Z" fill="${c.dark}" opacity=".55" transform="translate(-2 0)"/>` +
    `<path d="M52 12.5 V88 M56 14 V88" stroke="${c.line}" stroke-width=".8" opacity=".5"/>` +
    [30, 42, 54, 66, 78].map((y) => `<circle cx="54" cy="${y}" r="1.4" fill="${c.dark}" opacity=".85"/>`).join('') +
    `<path d="M24 80 H48 M52 80 H76" stroke="${c.line}" stroke-width=".7" opacity=".3"/><path d="M94 70 L84 74 M6 70 L16 74" stroke="${c.dark}" stroke-width="3" opacity=".3"/>`
};
A.hoodie = {
  back: ['M33 14 Q50 -8 67 14 Q50 26 33 14Z'],
  half: ['M50 14 L62 12 L80 19 L94 70 L84 74 L76 48 L76 88 L50 88 Z'],
  detail: (c) =>
    `<path d="M36 13 Q50 -1 64 13 Q50 30 36 13Z" fill="${c.dark}" opacity=".5"/><path d="M44 26 V42 M56 26 V42" stroke="${c.light}" stroke-width="1.4" opacity=".9"/><circle cx="44" cy="43" r="1.4" fill="${c.light}"/><circle cx="56" cy="43" r="1.4" fill="${c.light}"/>` +
    `<path d="M32 62 H68 L72 82 H28Z" fill="${c.dark}" opacity=".12" stroke="${c.line}" stroke-width=".8"/><path d="M24 84 H76 V88 H24Z" fill="${c.dark}" opacity=".2"/>` +
    `<path d="M94 70 L84 74 M6 70 L16 74" stroke="${c.dark}" stroke-width="3.2" opacity=".35"/>`
};

// ── bottoms ─────────────────────────────────────────────────────────────
const WAIST = (c) => `<path d="M22 8 H78 V15 H22Z" fill="${c.dark}" opacity=".22"/><path d="M22 15 H78" stroke="${c.line}" stroke-width=".7" opacity=".5"/>`;
A.pants = {
  half: ['M50 8 L79 8 L84 92 L66 92 L53 38 L50 38 Z'],
  detail: (c) => WAIST(c) + `<path d="M50 15 V38" stroke="${c.line}" stroke-width=".8" opacity=".5"/><path d="M78 16 Q68 20 65 32" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".5"/><path d="M22 16 Q32 20 35 32" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".5"/>`
};
A.jeans = {
  half: ['M50 8 L79 8 L84 92 L64 92 L52 40 L50 40 Z'],
  detail: (c) =>
    WAIST(c) + `<path d="M50 15 V40" stroke="${c.light}" stroke-width=".9" stroke-dasharray="1.4 1.2" opacity=".8"/>` +
    `<path d="M78 16 Q68 20 65 32" stroke="${c.light}" stroke-width=".9" fill="none" stroke-dasharray="1.4 1.2" opacity=".8"/><path d="M22 16 Q32 20 35 32" stroke="${c.light}" stroke-width=".9" fill="none" stroke-dasharray="1.4 1.2" opacity=".8"/>` +
    `<path d="M68 22 H76 V30 H68Z" fill="none" stroke="${c.light}" stroke-width=".8" stroke-dasharray="1.4 1.2" opacity=".7"/><circle cx="50" cy="11.5" r="1.4" fill="${c.light}" opacity=".9"/><path d="M62 88 H83" stroke="${c.light}" stroke-width=".8" stroke-dasharray="1.4 1.2" opacity=".6"/><path d="M17 88 H38" stroke="${c.light}" stroke-width=".8" stroke-dasharray="1.4 1.2" opacity=".6"/>`
};
A.trousers = {
  half: ['M50 8 L77 8 L80 92 L63 92 L52 44 L50 44 Z'],
  detail: (c) => WAIST(c) + `<path d="M50 15 V44" stroke="${c.line}" stroke-width=".8" opacity=".5"/><path d="M62 18 L64 40 M38 18 L36 40" stroke="${c.line}" stroke-width=".7" opacity=".35"/><path d="M71 46 L71.5 92 M29 46 L28.5 92" stroke="${c.line}" stroke-width=".7" opacity=".3"/><circle cx="50" cy="11.5" r="1.3" fill="${c.dark}" opacity=".7"/>`
};
A.cargo = {
  half: ['M50 8 L80 8 L85 92 L63 92 L52 40 L50 40 Z'],
  detail: (c) => WAIST(c) + `<path d="M50 15 V40" stroke="${c.line}" stroke-width=".8" opacity=".5"/><path d="M72 46 H84 V62 H72Z M28 46 H16 V62 H28Z" fill="${c.dark}" opacity=".14" stroke="${c.line}" stroke-width=".8"/><path d="M72 50 H84 M28 50 H16" stroke="${c.line}" stroke-width=".7" opacity=".5"/>`
};
A.joggers = {
  half: ['M50 8 L79 8 L82 52 L78 88 L63 88 L58 52 L50 40 Z'],
  detail: (c) => WAIST(c) + `<path d="M44 16 V30 M56 16 V30" stroke="${c.light}" stroke-width="1.2" opacity=".9"/><path d="M63 82 H78 V88 H63Z" fill="${c.dark}" opacity=".28"/><path d="M22 82 H37 V88 H22Z" fill="${c.dark}" opacity=".28"/>`
};
A.leggings = {
  half: ['M50 8 L73 8 L75 92 L61 92 L52 38 L50 38 Z'],
  detail: (c) => `<path d="M27 8 H73 V13 H27Z" fill="${c.dark}" opacity=".25"/><path d="M66 20 Q70 55 68 90" stroke="${c.light}" stroke-width=".8" fill="none" opacity=".35"/>`
};
A.shorts = {
  half: ['M50 16 L80 16 L86 64 L59 64 L51 42 L50 42 Z'],
  detail: (c) => `<path d="M20 16 H80 V23 H20Z" fill="${c.dark}" opacity=".22"/><path d="M50 23 V42" stroke="${c.line}" stroke-width=".8" opacity=".5"/><path d="M79 24 Q69 28 66 40" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".5"/><path d="M60 59 H85" stroke="${c.line}" stroke-width=".7" stroke-dasharray="1.4 1.2" opacity=".5"/>`
};
A.skirt = {
  half: ['M50 14 L70 14 L90 86 L50 86 Z'],
  detail: (c) => `<path d="M30 14 H70 V21 H30Z" fill="${c.dark}" opacity=".22"/><path d="M42 21 L34 86 M58 21 L66 86 M50 21 V86" stroke="${c.line}" stroke-width=".7" opacity=".28"/><path d="M12 86 H88" stroke="${c.line}" stroke-width=".8" opacity=".4"/>`
};

// ── one-pieces ──────────────────────────────────────────────────────────
A.dress = {
  half: ['M50 24 Q56 23 58 8 L64 8 Q65 28 67 40 L65 50 L90 94 L50 94 Z'],
  detail: (c) => `<path d="M36 8 L42 8 Q50 30 58 8 L64 8" fill="none"/><path d="M36 8 Q50 36 64 8 Q50 20 36 8Z" fill="${c.dark}" opacity=".4"/><path d="M33 49 Q50 53 67 49" stroke="${c.line}" stroke-width=".9" fill="none" opacity=".5"/><path d="M50 53 V94" stroke="${c.line}" stroke-width=".6" opacity=".2"/><path d="M12 94 H88" stroke="${c.line}" stroke-width=".8" opacity=".35"/>`
};
A.jumpsuit = {
  half: ['M50 24 Q56 23 58 8 L64 8 Q65 28 67 40 L68 50 L82 94 L63 94 L52 60 L50 60 Z'],
  detail: (c) => `<path d="M36 8 Q50 36 64 8 Q50 20 36 8Z" fill="${c.dark}" opacity=".4"/><path d="M32 50 Q50 55 68 50" stroke="${c.line}" stroke-width=".9" fill="none" opacity=".5"/><path d="M50 55 V60" stroke="${c.line}" stroke-width=".8" opacity=".5"/><path d="M44 52 H56" stroke="${c.dark}" stroke-width="2" opacity=".4"/>`
};

// ── outerwear ───────────────────────────────────────────────────────────
A.jacket = {
  half: ['M52 16 L61 11 L81 19 L95 72 L85 76 L77 48 L77 90 L52 90 Z'],
  detail: (c) =>
    `<path d="M45 14 H54 V90 H45Z" fill="${c.dark}" opacity=".65" transform="translate(-1 0)"/>` +
    `<path d="M52 16 L61 11 L66 17 L58 27 Z" fill="${c.light}" opacity=".85"/><path d="M48 16 L39 11 L34 17 L42 27 Z" fill="${c.light}" opacity=".85"/>` +
    `<path d="M52 16 V90" stroke="${c.line}" stroke-width="1" opacity=".7"/><path d="M62 62 H72 M38 62 H28" stroke="${c.line}" stroke-width=".9" opacity=".55"/>` +
    `<path d="M95 72 L85 76 M5 72 L15 76" stroke="${c.dark}" stroke-width="3" opacity=".3"/><path d="M24 86 H76" stroke="${c.line}" stroke-width=".8" opacity=".4"/>`
};
A.blazer = {
  half: ['M52 30 L60 11 L81 19 L95 74 L85 78 L77 50 L77 94 L52 94 Z'],
  detail: (c) =>
    `<path d="M38 11 L50 42 L62 11 Z" fill="#f4f1ea"/><path d="M44 12 L50 20 L56 12" fill="none" stroke="#c9c4b8" stroke-width=".8"/>` +
    `<path d="M52 30 L60 11 L69 30 L58 42 Z" fill="${c.light}" opacity=".8"/><path d="M48 30 L40 11 L31 30 L42 42 Z" fill="${c.light}" opacity=".8"/>` +
    `<path d="M52 30 L58 42 L52 94 M48 30 L42 42 L48 94" stroke="${c.line}" stroke-width=".9" fill="none" opacity=".6"/>` +
    `<circle cx="54" cy="64" r="1.5" fill="${c.dark}"/><circle cx="54" cy="76" r="1.5" fill="${c.dark}"/>` +
    `<path d="M64 70 H74 V73 H64Z M26 70 H36 V73 H26Z" fill="${c.dark}" opacity=".3"/><path d="M95 74 L85 78 M5 74 L15 78" stroke="${c.dark}" stroke-width="3" opacity=".3"/>`
};
A.coat = {
  half: ['M52 28 L60 10 L81 18 L95 76 L85 80 L78 50 L84 98 L52 98 Z'],
  detail: (c) =>
    `<path d="M38 10 L50 42 L62 10 Z" fill="${c.dark}" opacity=".6"/>` +
    `<path d="M52 28 L60 10 L70 30 L58 44 Z" fill="${c.light}" opacity=".75"/><path d="M48 28 L40 10 L30 30 L42 44 Z" fill="${c.light}" opacity=".75"/>` +
    `<path d="M52 28 L58 44 L52 98 M48 28 L42 44 L48 98" stroke="${c.line}" stroke-width="1" fill="none" opacity=".65"/>` +
    [62, 74, 86].map((y) => `<circle cx="56" cy="${y}" r="1.6" fill="${c.dark}"/><circle cx="44" cy="${y}" r="1.6" fill="${c.dark}"/>`).join('') +
    `<path d="M24 62 H46 M54 62 H76" stroke="${c.line}" stroke-width=".8" opacity=".4"/><path d="M95 76 L85 80 M5 76 L15 80" stroke="${c.dark}" stroke-width="3" opacity=".3"/>`
};
A.puffer = {
  half: ['M50 14 L62 12 L82 22 L96 70 L85 74 L79 44 L79 86 Q70 90 50 90 Z'],
  detail: (c) =>
    `<path d="M40 5 H60 V16 H40Z" fill="${c.light}" opacity=".7" stroke="${c.line}" stroke-width=".8"/>` +
    [34, 48, 62, 76].map((y) => `<path d="M22 ${y} Q50 ${y + 4} 78 ${y}" stroke="${c.line}" stroke-width=".9" fill="none" opacity=".5"/>`).join('') +
    `<path d="M50 16 V90" stroke="${c.light}" stroke-width="1.6" opacity=".7"/><path d="M89 40 L84 56 M11 40 L16 56 M92 55 L86 66 M8 55 L14 66" stroke="${c.line}" stroke-width=".8" opacity=".45"/>`
};

// ── shoes (side view, toe to the right) ─────────────────────────────────
const SOLE = (c, fill = '#f2efe8') => `<path d="M8 76 H96 V80 Q96 85 90 85 H14 Q8 85 8 80Z" fill="${fill}" stroke="${c.line}" stroke-width=".9"/>`;
A.sneaker = {
  vb: '4 38 98 50',
  full: ['M10 76 L10 55 Q10 47 18 47 L30 47 Q36 47 40 51 L46 54 L66 58 Q80 60 90 66 Q98 70 98 76 Z'],
  detail: (c) =>
    SOLE(c) +
    [46, 52, 58, 64].map((x, i) => `<path d="M${x - 4} ${51 + i * 1.6} L${x + 4} ${58 + i * 1.2}" stroke="${c.light}" stroke-width="1.5" stroke-linecap="round" opacity=".95"/>`).join('') +
    `<path d="M40 49 L66 57" stroke="${c.line}" stroke-width=".8" opacity=".5"/><path d="M80 60 Q90 64 91 74" stroke="${c.line}" stroke-width=".9" fill="none" opacity=".5"/>` +
    `<path d="M10 56 H22 V68 H10Z" fill="${c.dark}" opacity=".22"/><path d="M12 46 H24" stroke="${c.light}" stroke-width="1.6" opacity=".7"/>`
};
A.loafer = {
  vb: '4 50 98 38',
  full: ['M8 70 Q8 62 19 60 L40 55 Q54 53 61 58 Q73 64 90 66 Q98 68 98 74 L98 77 H8 Z'],
  detail: (c) => SOLE(c, c.dark) + `<path d="M44 56 L62 59 L58 67 L42 64 Z" fill="${c.light}" opacity=".5" stroke="${c.line}" stroke-width=".8"/><path d="M46 60 H58" stroke="${c.dark}" stroke-width="1.2" opacity=".6"/><path d="M8 72 H20" stroke="${c.line}" stroke-width=".7" opacity=".4"/>`
};
A.boot = {
  vb: '6 8 94 82',
  full: ['M22 14 L52 14 L54 52 Q58 58 74 62 Q96 66 96 76 L96 78 H12 L12 24 Q12 14 22 14 Z'],
  detail: (c) =>
    `<path d="M8 76 H96 V81 Q96 86 90 86 H14 Q8 86 8 81Z" fill="${c.dark}" opacity=".85" stroke="${c.line}" stroke-width=".9"/>` +
    `<path d="M12 70 H96" stroke="${c.line}" stroke-width=".8" opacity=".4"/><path d="M26 14 V22 L32 22 V14" fill="${c.dark}" opacity=".4"/>` +
    [30, 38, 46].map((y) => `<path d="M42 ${y} H52" stroke="${c.light}" stroke-width="1.3" opacity=".85"/>`).join('') + `<path d="M22 14 H52" stroke="${c.line}" stroke-width="1.2" opacity=".6"/>`
};
A.sandal = {
  vb: '4 60 98 30',
  full: ['M8 76 Q8 70 16 70 L84 70 Q96 70 96 77 Q96 83 86 83 L16 83 Q8 83 8 76 Z'],
  detail: (c) =>
    `<path d="M32 70 Q48 40 70 70" fill="none" stroke="${c.fill}" stroke-width="7" stroke-linecap="round"/><path d="M32 70 Q48 40 70 70" fill="none" stroke="${c.line}" stroke-width=".8" opacity=".6"/>` +
    `<path d="M54 70 Q58 54 68 70" fill="none" stroke="${c.fill}" stroke-width="6" stroke-linecap="round"/><circle cx="48" cy="58" r="1.4" fill="${c.dark}"/>` +
    `<path d="M10 83 H94" stroke="${c.dark}" stroke-width="2.4" opacity=".4"/>`
};
A.heel = {
  vb: '8 20 94 78',
  full: ['M12 34 Q12 28 18 28 Q22 28 26 36 Q36 52 56 60 Q76 66 92 68 Q99 69 98 75 Q96 80 88 79 L58 76 Q40 74 30 64 L27 56 Q20 52 16 48 Q12 42 12 34 Z', 'M21 50 L25 94 H31 L33 62 Z'],
  detail: (c) => `<path d="M14 36 Q16 30 22 32 Q30 50 54 58" stroke="${c.light}" stroke-width="1.1" fill="none" opacity=".7"/><path d="M58 76 L88 79" stroke="${c.dark}" stroke-width="1.6" opacity=".5"/><path d="M25 94 H31" stroke="${c.dark}" stroke-width="2.4" opacity=".7"/>`
};
// ── accessories ─────────────────────────────────────────────────────────
A.scarf = {
  vb: '14 -2 72 102',
  full: ['M22 14 Q50 -2 78 14 L80 30 Q50 18 20 30 Z', 'M32 24 L53 28 L51 90 L28 88 Z', 'M50 27 L72 24 L74 84 L53 90 Z'],
  detail: (c) =>
    `<path d="M22 14 Q50 -2 78 14" fill="none" stroke="${c.light}" stroke-width="1" opacity=".6"/><path d="M53 28 L51 90" stroke="${c.line}" stroke-width=".9" opacity=".5"/>` +
    `<path d="M29 80 L51 82 M29 84 L51 86 M54 82 L74 78 M54 86 L74 82" stroke="${c.line}" stroke-width=".7" opacity=".4"/>` +
    [31, 36, 41, 46].map((x) => `<path d="M${x} 88 V97" stroke="${c.fill}" stroke-width="2.2" stroke-linecap="round"/>`).join('') +
    [56, 61, 66, 71].map((x) => `<path d="M${x} 87 V96" stroke="${c.fill}" stroke-width="2.2" stroke-linecap="round"/>`).join('')
};
A.beanie = {
  vb: '14 2 72 88',
  full: ['M22 64 Q20 18 50 16 Q80 18 78 64 Z', 'M19 64 H81 V82 Q50 86 19 82 Z'],
  detail: (c) => [26, 33, 40, 47, 54, 61, 68, 74].map((x) => `<path d="M${x} 66 V82" stroke="${c.line}" stroke-width=".7" opacity=".4"/>`).join('') + `<circle cx="50" cy="12" r="7.5" fill="${c.light}" stroke="${c.line}" stroke-width=".8"/><path d="M30 40 Q50 32 70 40" stroke="${c.line}" stroke-width=".6" fill="none" opacity=".25"/>`
};
A.gloves = {
  vb: '8 14 84 74',
  full: ['M16 38 Q16 20 28 20 Q38 20 38 32 L38 40 L44 30 Q48 30 48 36 L44 50 L46 74 Q46 82 38 82 H22 Q16 82 16 74 Z', 'M84 38 Q84 20 72 20 Q62 20 62 32 L62 40 L56 30 Q52 30 52 36 L56 50 L54 74 Q54 82 62 82 H78 Q84 82 84 74 Z'],
  detail: (c) => `<path d="M17 66 H45 M83 66 H55" stroke="${c.dark}" stroke-width="5" opacity=".25"/>`
};
A.sunglasses = {
  vb: '0 24 100 40',
  half: ['M52 38 Q52 30 60 30 L80 30 Q90 30 90 40 Q90 56 76 58 Q58 58 54 44 Z'],
  detail: (c) => `<path d="M46 40 Q50 36 54 40" stroke="${c.dark}" stroke-width="2" fill="none"/><path d="M92 36 L98 34 M8 34 L2 36" stroke="${c.dark}" stroke-width="2.2" stroke-linecap="round"/><path d="M62 36 Q66 34 72 36" stroke="#fff" stroke-width="1.6" opacity=".5" fill="none"/><path d="M38 36 Q34 34 28 36" stroke="#fff" stroke-width="1.6" opacity=".5" fill="none"/>`
};
A.cap = {
  vb: '14 16 90 56',
  full: ['M20 60 Q18 24 50 22 Q82 24 80 60 Z', 'M60 54 Q92 50 99 64 Q80 68 62 62 Z'],
  detail: (c) => `<circle cx="50" cy="23" r="3" fill="${c.dark}" opacity=".6"/><path d="M50 24 V58 M36 28 Q32 44 32 58 M64 28 Q68 44 68 58" stroke="${c.line}" stroke-width=".7" fill="none" opacity=".3"/><path d="M20 60 H80" stroke="${c.line}" stroke-width="1" opacity=".5"/>`
};
A.sunhat = {
  vb: '0 16 100 62',
  full: ['M4 62 Q50 42 96 62 Q50 78 4 62 Z', 'M28 60 Q30 22 50 22 Q70 22 72 60 Q50 68 28 60 Z'],
  detail: (c) => `<path d="M28 52 Q50 60 72 52 V58 Q50 66 28 58Z" fill="${c.dark}" opacity=".45"/><path d="M10 62 Q50 50 90 62" stroke="${c.line}" stroke-width=".6" fill="none" opacity=".3"/><path d="M22 66 Q50 74 78 66" stroke="${c.line}" stroke-width=".6" fill="none" opacity=".3"/>`
};
A.umbrella = {
  vb: '0 4 100 94',
  full: ['M6 52 Q8 14 50 12 Q92 14 94 52 Q83 44 72 52 Q61 44 50 52 Q39 44 28 52 Q17 44 6 52 Z'],
  detail: (c) => `<path d="M50 12 V52 M28 50 Q38 22 50 12 M72 50 Q62 22 50 12" stroke="${c.line}" stroke-width=".8" fill="none" opacity=".4"/><path d="M50 52 V86 Q50 94 58 92" fill="none" stroke="${c.dark}" stroke-width="3.4" stroke-linecap="round"/><circle cx="50" cy="10" r="2" fill="${c.dark}"/>`
};
A.belt = {
  vb: '0 36 100 28',
  full: ['M4 44 H96 V57 H4 Z'],
  detail: (c) => `<rect x="60" y="39" width="17" height="23" rx="2.5" fill="none" stroke="#b8a37a" stroke-width="3"/><path d="M64 50 H78" stroke="#b8a37a" stroke-width="2.4"/>` + [14, 24, 34, 44].map((x) => `<circle cx="${x}" cy="50.5" r="1.3" fill="${c.dark}" opacity=".7"/>`).join('') + `<path d="M4 46.5 H96 M4 54.5 H96" stroke="${c.line}" stroke-width=".6" stroke-dasharray="1.6 1.2" opacity=".5"/>`
};
A.bag = {
  vb: '8 6 84 90',
  full: ['M20 40 H80 L87 92 H13 Z'],
  detail: (c) => `<path d="M33 40 Q33 12 50 12 Q67 12 67 40" fill="none" stroke="${c.fill}" stroke-width="5.5" stroke-linecap="round"/><path d="M33 40 Q33 12 50 12 Q67 12 67 40" fill="none" stroke="${c.line}" stroke-width=".8" opacity=".55"/><path d="M20 40 H80" stroke="${c.line}" stroke-width="1" opacity=".5"/><path d="M26 60 H74" stroke="${c.line}" stroke-width=".7" opacity=".25"/>`
};
A.watch = {
  vb: '30 0 40 100',
  full: ['M42 6 H58 L61 36 H39 Z', 'M39 64 H61 L58 94 H42 Z'],
  detail: (c) => `<circle cx="50" cy="50" r="18" fill="#f5f2ea" stroke="${c.dark}" stroke-width="3.6"/><path d="M50 50 V38 M50 50 L59 55" stroke="${c.dark}" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="50" r="1.6" fill="${c.dark}"/>` + [0, 90, 180, 270].map((d) => `<path d="M50 34 V36" transform="rotate(${d} 50 50)" stroke="${c.dark}" stroke-width="1.4"/>`).join('') + `<path d="M46 14 H54 M45 86 H55" stroke="${c.line}" stroke-width=".7" opacity=".5"/>`
};

export const ART_KEYS = Object.keys(A);
export const viewBoxFor = (art) => (A[art] && A[art].vb) || '0 0 100 100';

/** Pattern overlays, clipped to the silhouette. */
function patternDefs(id, pattern, c) {
  const ink = c.dark;
  switch (pattern) {
    case 'striped':
      return `<pattern id="p${id}" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="3.4" fill="${ink}" opacity=".55"/></pattern>`;
    case 'checked':
      return `<pattern id="p${id}" width="11" height="11" patternUnits="userSpaceOnUse"><rect width="11" height="4" fill="${ink}" opacity=".35"/><rect width="4" height="11" fill="${ink}" opacity=".35"/></pattern>`;
    case 'dotted':
      return `<pattern id="p${id}" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.7" fill="${c.light}" opacity=".95"/></pattern>`;
    case 'floral': {
      const petals = (cx, cy, r, fill) => [0, 72, 144, 216, 288].map((a) => `<circle cx="${(cx + Math.cos((a * Math.PI) / 180) * r).toFixed(2)}" cy="${(cy + Math.sin((a * Math.PI) / 180) * r).toFixed(2)}" r="${(r * 0.78).toFixed(2)}" fill="${fill}"/>`).join('');
      return `<pattern id="p${id}" width="20" height="20" patternUnits="userSpaceOnUse"><g opacity=".92">${petals(6, 6, 2.5, c.light)}<circle cx="6" cy="6" r="1.3" fill="${ink}" opacity=".6"/></g><g opacity=".8">${petals(16, 15, 1.9, c.light)}<circle cx="16" cy="15" r=".9" fill="${ink}" opacity=".6"/></g><path d="M11 9 q2 -1 3 1 q-2 1 -3 -1z M2 15 q2 -1 3 1 q-2 1 -3 -1z" fill="${ink}" opacity=".35"/></pattern>`;
    }
    case 'animal':
      return `<pattern id="p${id}" width="14" height="14" patternUnits="userSpaceOnUse"><ellipse cx="4" cy="4" rx="2.6" ry="1.6" fill="${ink}" opacity=".7" transform="rotate(30 4 4)"/><ellipse cx="11" cy="10" rx="2.2" ry="1.4" fill="${ink}" opacity=".7" transform="rotate(-20 11 10)"/></pattern>`;
    case 'graphic':
      return `<pattern id="p${id}" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="42" r="12" fill="${c.light}" opacity=".9"/><path d="M42 42 L50 34 L58 42 L50 50Z" fill="${ink}" opacity=".7"/></pattern>`;
    case 'textured':
      return `<pattern id="p${id}" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 4 L4 0" stroke="${ink}" stroke-width=".5" opacity=".25"/></pattern>`;
    default:
      return '';
  }
}

let counter = 0;

/**
 * Inner SVG markup (for a 0 0 100 100 viewBox) for a garment.
 * @param {string} art  key from the taxonomy's `art`
 * @param {string} hex  garment colour
 * @param {string} [pattern]
 */
export function garmentMarkup(art, hex, pattern = 'solid') {
  const def = A[art] || A.tee;
  const id = `${(counter += 1)}`;
  const { l } = hexToHsl(hex);
  const c = {
    fill: hex,
    dark: darken(hex, 0.45),
    light: lighten(hex, l > 0.7 ? 0.0 : 0.55),
    line: darken(hex, l > 0.6 ? 0.55 : 0.5),
    id
  };
  if (l > 0.7) c.light = darken(hex, 0.04);
  if (l < 0.18) {
    c.light = lighten(hex, 0.3);
    c.line = lighten(hex, 0.2);
  }

  const shapes = [];
  const draw = (paths, extra = '') => paths.forEach((d) => shapes.push(`<path d="${d}" ${extra}/>`));
  const both = (paths) => {
    draw(paths);
    draw(paths, `transform="${MIRROR}"`);
  };
  const clipBody = [];
  const body = (paths, mirrored) => {
    for (const d of paths) {
      clipBody.push(`<path d="${d}"/>`);
      if (mirrored) clipBody.push(`<path d="${d}" transform="${MIRROR}"/>`);
    }
  };
  if (def.back) body(def.back, true);
  if (def.half) body(def.half, true);
  if (def.full) body(def.full, false);
  void both;
  // Outline first (a stroke twice as wide as it will show), then the fill on top: the fill hides
  // the inner half of the stroke, so mirrored halves join without a centre seam.
  const strokeAttrs = `fill="${c.line}" stroke="${c.line}" stroke-width="2.4" stroke-linejoin="round"`;
  const fillAttrs = `fill="${hex}"`;
  const paint = (paths, mirrored) => {
    const each = (attrs) => paths.map((d) => `<path d="${d}" ${attrs}/>` + (mirrored ? `<path d="${d}" transform="${MIRROR}" ${attrs}/>` : '')).join('');
    return each(strokeAttrs) + each(fillAttrs);
  };

  const defs =
    `<defs><clipPath id="c${id}">${clipBody.join('')}</clipPath>` +
    `<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>` +
    patternDefs(id, pattern, c) +
    `</defs>`;

  const back = def.back ? paint(def.back, true) : '';
  const main = (def.half ? paint(def.half, true) : '') + (def.full ? paint(def.full, false) : '');
  const sheen = `<g clip-path="url(#c${id})"><rect width="100" height="100" fill="url(#g${id})"/>${pattern !== 'solid' && pattern ? `<rect width="100" height="100" fill="url(#p${id})"/>` : ''}</g>`;
  const detail = def.detail ? def.detail(c) : '';
  return defs + back + main + sheen + detail;
}

/** Aspect hint so layouts can size tall vs wide pieces sensibly. */
export const ART_ASPECT = { sneaker: 'wide', loafer: 'wide', boot: 'wide', sandal: 'wide', heel: 'wide', belt: 'wide', sunhat: 'wide', cap: 'wide', sunglasses: 'wide', umbrella: 'wide' };

/** Compose an outfit flat-lay as markup for a 0 0 300 360 viewBox. */
export function outfitMarkup(items) {
  const by = (cat) => items.filter((i) => i.category === cat);
  const [dress] = by('dress');
  const tops = by('top');
  const [bottom] = by('bottom');
  const [outer] = by('outerwear');
  const [shoes] = by('shoes');
  const accessories = by('accessory').slice(0, 4);
  // A real cut-out photo of the person's own garment replaces the illustration.
  const cell = (item, x, y, w, h) =>
    item.image
      ? `<image href="${String(item.image).replace(/[&"<>]/g, '')}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
      : `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBoxFor(item.art)}" overflow="visible">${garmentMarkup(item.art, item.color, item.pattern)}</svg>`;
  const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="4.5" fill="#000" opacity=".07"/>`;
  let out = '';
  const hasRight = outer || shoes || accessories.length;

  // Board layout: main pieces on the left, outer layer / shoes / accessories on the right.
  // Without anything for the right-hand column the main pieces are centred instead.
  const dx = hasRight ? 0 : 60;
  if (dress) {
    out += shadow(92 + dx, 352, 56) + cell(dress, 14 + dx, 14, 156, 338);
  } else {
    if (tops[1]) out += cell(tops[1], 8 + dx, 8, 160, 160);
    if (tops[0]) out += cell(tops[0], (tops[1] ? 26 : 12) + dx, tops[1] ? 22 : 8, tops[1] ? 132 : 156, tops[1] ? 132 : 156);
    if (bottom) out += cell(bottom, 12 + dx, 156, 156, 196);
  }
  if (outer) out += shadow(228, 176, 50) + cell(outer, 152, 6, 144, 170);
  if (shoes) out += shadow(224, 258, 46) + cell(shoes, 168, 196, 112, 62);
  const slots = [[160, 284], [226, 284], [160, 322], [226, 322]];
  const size = accessories.length > 2 ? 34 : 56;
  accessories.forEach((a, i) => {
    const [x, y] = accessories.length > 2 ? slots[i] : [168 + i * 66, 290];
    out += cell(a, x, y, size, size);
  });
  return out;
}
