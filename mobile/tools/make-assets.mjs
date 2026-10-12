#!/usr/bin/env node
/**
 * Draws the app icon and launch screen sources (assets/*.png) from the ModaWard mark (an M with a sun).
 * `npm run assets` then turns them into every size iOS and Android need.
 * Run `npm run assets` (in mobile/) only if the logo changes; it installs its own tools first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // the mobile/ folder
const out = path.join(root, 'assets');
fs.mkdirSync(out, { recursive: true });

const GREEN = '#1f3d33';
const CREAM = '#f6f3ed';
const NIGHT = '#100f0d';
const SAND = '#d9c9a3';
const CORAL = '#e0825f';

// the mark, drawn in a 32x32 box (the same paths as public/icons/icon.svg)
const mark = (stroke, heart) =>
  `<g fill="none"><path d="M6 26V14.2a1.7 1.7 0 0 1 2.9-1.2L16 20l7.1-7a1.7 1.7 0 0 1 2.9 1.2V26" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="9.6" r="2.7" fill="${heart}"/><g stroke="${heart}" stroke-width="1.5" stroke-linecap="round"><path d="M16 5.1V3.6M12.82 6.42l-1.06-1.06M19.18 6.42l1.06-1.06M11.5 9.6H10M20.5 9.6H22"/></g></g>`;

/** A square canvas of `size` px with the mark centred, `fraction` of the canvas wide. `bg` = null for transparent. */
const canvas = (size, fraction, bg, stroke, heart) => {
  const w = size * fraction;
  const scale = w / 32;
  const x = (size - 32 * scale) / 2;
  const y = (size - 32 * scale) / 2 + 1.4 * scale; // the mark sits high in its own box, so drop it to the optical centre
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}<g transform="translate(${x} ${y}) scale(${scale})">${mark(stroke, heart)}</g></svg>`;
};

const files = {
  // iOS: a full-bleed square (the system rounds the corners)
  'icon-only.png': [1024, canvas(1024, 0.62, GREEN, CREAM, CORAL)],
  // Android adaptive icon: the mark must stay inside the middle two thirds, over a plain background
  'icon-foreground.png': [1024, canvas(1024, 0.5, null, CREAM, CORAL)],
  'icon-background.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${GREEN}"/></svg>`],
  // launch screens
  'splash.png': [2732, canvas(2732, 0.14, CREAM, GREEN, CORAL)],
  'splash-dark.png': [2732, canvas(2732, 0.14, NIGHT, SAND, CORAL)]
};

for (const [name, [size, svg]] of Object.entries(files)) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(out, name));
  console.log(`assets/${name}`);
}
