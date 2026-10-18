#!/usr/bin/env node
/**
 * A contact sheet of every catalogue-look template in a few colours and fabrics, to judge them by eye.
 *   node scripts/preview-templates.mjs out.png [type ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { renderCatalogue } from '../src/shared/catalogue.js';
import { templateFile } from '../src/shared/template-index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.TEMPLATES_DIR || path.join(root, 'public', 'templates');
const [out = 'templates-preview.png', ...types] = process.argv.slice(2);
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const list = index.templates.filter((e) => !types.length || types.includes(e.type));
const LOOKS = [
  { colors: ['#f4f1ea'], fabric: 'solid' },
  { colors: ['#1f2a44'], fabric: 'solid' },
  { colors: ['#b3262e'], fabric: 'solid' },
  { colors: ['#5f7f5a'], fabric: 'linen' },
  { colors: ['#2f5d8a'], fabric: 'stripe' },
  { colors: ['#c8553d'], fabric: 'gingham' },
  { colors: ['#e9c46a'], fabric: 'floral-large' },
  { colors: ['#3b5b8c'], fabric: 'denim' },
];
const CELL = 260;

const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(fs.existsSync) : undefined);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.evaluate(({ w, h }) => {
    const c = document.createElement('canvas');
    c.id = 'sheet';
    c.width = w;
    c.height = h;
    document.body.append(c);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }, { w: CELL * LOOKS.length, h: CELL * list.length });
  for (const [row, e] of list.entries()) {
    const file = path.join(dir, path.relative('templates', templateFile(e)));
    const decoded = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let s = '';
      for (let i = 0; i < d.length; i += 8192) s += String.fromCharCode(...d.subarray(i, i + 8192));
      return { width: c.width, height: c.height, b64: btoa(s) };
    }, `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`);
    const tpl = { data: new Uint8ClampedArray(Buffer.from(decoded.b64, 'base64')), width: decoded.width, height: decoded.height };
    for (const [col, look] of LOOKS.entries()) {
      const img = renderCatalogue(tpl, { ...look, widthUnits: e.widthCm });
      await page.evaluate(({ b64, w, h, x, y, cell, label }) => {
        const bytes = Uint8ClampedArray.from(atob(b64), (c) => c.charCodeAt(0));
        const a = document.createElement('canvas');
        a.width = w;
        a.height = h;
        a.getContext('2d').putImageData(new ImageData(bytes, w, h), 0, 0);
        const ctx = document.getElementById('sheet').getContext('2d');
        const k = Math.min((cell - 24) / w, (cell - 34) / h);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(a, x + (cell - w * k) / 2, y + 22 + (cell - 34 - h * k) / 2, w * k, h * k);
        if (label) {
          ctx.fillStyle = '#333';
          ctx.font = '14px sans-serif';
          ctx.fillText(label, x + 8, y + 16);
        }
      }, { b64: Buffer.from(img.data.buffer).toString('base64'), w: img.width, h: img.height, x: col * CELL, y: row * CELL, cell: CELL, label: col === 0 ? `${e.type}/${e.id}` : '' });
    }
  }
  const png = await page.evaluate(() => document.getElementById('sheet').toDataURL('image/png').split(',')[1]);
  fs.writeFileSync(out, Buffer.from(png, 'base64'));
  console.log(`Wrote ${out}: ${list.length} templates x ${LOOKS.length} looks`);
} finally {
  await browser.close();
}
