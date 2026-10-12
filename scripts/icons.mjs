// Renders the PNG app icons from the logo mark using Chromium (already installed for e2e tests).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'icons');

const mark = (scale, tx, ty) => `<g transform="translate(${tx} ${ty}) scale(${scale})" fill="none"><path d="M6 26V14.2a1.7 1.7 0 0 1 2.9-1.2L16 20l7.1-7a1.7 1.7 0 0 1 2.9 1.2V26" stroke="#f6f3ed" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="9.6" r="2.7" fill="#e0825f"/><g stroke="#e0825f" stroke-width="1.5" stroke-linecap="round"><path d="M16 5.1V3.6M12.82 6.42l-1.06-1.06M19.18 6.42l1.06-1.06M11.5 9.6H10M20.5 9.6H22"/></g></g>`;
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

// The browser-tab icon: a simpler mark (no rays) so it stays readable at 16 pixels, as favicon.svg, plus PNG sizes
// bundled into favicon.ico for the browsers and tools that still ask for /favicon.ico.
const faviconSvg = fs.readFileSync(path.join(out, 'favicon.svg'), 'utf8');
const pngs = [];
for (const size of [16, 32, 48]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${faviconSvg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  const buf = await page.screenshot({ omitBackground: true });
  pngs.push({ size, buf });
  if (size === 32) fs.writeFileSync(path.join(out, 'favicon-32.png'), buf);
}
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map(({ size, buf }) => {
  const e = Buffer.alloc(16);
  e[0] = size;
  e[1] = size;
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
fs.writeFileSync(path.join(root, 'public', 'favicon.ico'), Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]));
console.log('wrote favicon-32.png and favicon.ico');
await browser.close();
