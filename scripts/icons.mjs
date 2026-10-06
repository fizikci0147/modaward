// Renders the PNG app icons from the logo mark using Chromium (already installed for e2e tests).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'icons');

const mark = (scale, tx, ty) => `<g transform="translate(${tx} ${ty}) scale(${scale})" fill="none"><path d="M16 10.2V8.6a2.9 2.9 0 1 0-2.9-2.9" stroke="#f6f3ed" stroke-width="2.1" stroke-linecap="round"/><path d="M16 10.2 4.6 19.2a2.1 2.1 0 0 0 1.3 3.8h20.2a2.1 2.1 0 0 0 1.3-3.8L16 10.2Z" stroke="#f6f3ed" stroke-width="2.1" stroke-linejoin="round"/><path d="M16 26.3s2.4-2.5 2.4-4a2.4 2.4 0 0 0-4.8 0c0 1.5 2.4 4 2.4 4Z" fill="#e0825f"/></g>`;
const svg = (rounded, scale) => {
  const size = 32 * scale;
  const t = (512 - size) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="#1f3d33"/>${mark(scale, t, t + 8)}</svg>`;
};

const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(fs.existsSync) : undefined);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage();
const jobs = [
  ['icon-192.png', 192, true, 10.4],
  ['icon-512.png', 512, true, 10.4],
  ['icon-maskable-512.png', 512, false, 8.2], // keeps the mark inside the safe zone
  ['apple-touch-icon.png', 180, false, 9.2]
];
for (const [name, size, rounded, scale] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(rounded, scale).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: path.join(out, name), omitBackground: true });
  console.log('wrote', name);
}
await browser.close();
