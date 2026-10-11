#!/usr/bin/env node
/**
 * Draws the app icon and launch screen sources (assets/*.png) from the ModaWard hanger mark.
 * `npm run assets` then turns them into every size iOS and Android need.
 * Re-run both only if the logo changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets');
fs.mkdirSync(out, { recursive: true });

const GREEN = '#1f3d33';
const CREAM = '#f6f3ed';
const NIGHT = '#100f0d';
const SAND = '#d9c9a3';
const CORAL = '#e0825f';

// the mark, drawn in a 32x32 box (the same paths as public/icons/icon.svg)
const mark = (stroke, heart) =>
  `<g fill="none"><path d="M16 10.2V8.6a2.9 2.9 0 1 0-2.9-2.9" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round"/><path d="M16 10.2 4.6 19.2a2.1 2.1 0 0 0 1.3 3.8h20.2a2.1 2.1 0 0 0 1.3-3.8L16 10.2Z" stroke="${stroke}" stroke-width="2.1" stroke-linejoin="round"/><path d="M16 26.3s2.4-2.5 2.4-4a2.4 2.4 0 0 0-4.8 0c0 1.5 2.4 4 2.4 4Z" fill="${heart}"/></g>`;

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
