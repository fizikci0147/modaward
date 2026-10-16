#!/usr/bin/env node
/**
 * Turn a photograph of a garment into a catalogue-look template (see docs/TEMPLATES.md).
 *
 *   npm run template:add -- photo.jpg --type shirt --id classic-collar --label "Classic collar" [--width 58] [--tags long-sleeve,button]
 *
 * It removes the backdrop (unless the photo already has a transparent one), straightens and crops, takes the colour out so
 * only the light and shadow stay, and writes public/templates/<type>/<id>.png and the entry in public/templates/index.json.
 * The browser that is installed for the tests does the image decoding and PNG writing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { segment, renderCutout } from '../src/shared/cutout.js';
import { straightenAngle, rotateImage, cropToContent } from '../src/shared/polish.js';
import { makeTemplate } from '../src/shared/catalogue.js';
import { entryProblems, indexProblems } from '../src/shared/template-index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.TEMPLATES_DIR || path.join(root, 'public', 'templates'); // the override is for tests
const MAX_SIDE = 1200;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const entry = { id: opt('id'), type: opt('type'), label: opt('label'), widthCm: Number(opt('width') ?? 55), ...(opt('tags') ? { tags: opt('tags').split(',') } : {}) };
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
if (!file || !fs.existsSync(file)) fail('Give the photo to use: npm run template:add -- photo.jpg --type shirt --id classic-collar --label "Classic collar"');
entry.label ??= entry.id;
const problems = entryProblems(entry);
if (problems.length) fail(`Cannot add this template:\n - ${problems.join('\n - ')}`);

const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(fs.existsSync) : undefined);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const mime = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg';
  const b64 = fs.readFileSync(file).toString('base64');
  const decoded = await page.evaluate(
    async ({ src, maxSide }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let s = '';
      for (let i = 0; i < d.length; i += 8192) s += String.fromCharCode(...d.subarray(i, i + 8192));
      return { width: c.width, height: c.height, b64: btoa(s) };
    },
    { src: `data:${mime};base64,${b64}`, maxSide: MAX_SIDE * 1.4 }
  );
  let img = { data: new Uint8ClampedArray(Buffer.from(decoded.b64, 'base64')), width: decoded.width, height: decoded.height };

  let transparent = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 250) transparent++;
  if (transparent < img.width * img.height * 0.02) {
    const seg = segment(img);
    if (!seg.ok) fail(`Could not find the garment against the backdrop (${seg.reason}). Photograph it on a plain, evenly lit surface, or cut it out first and pass a transparent PNG.`);
    img = renderCutout(img, seg, { maxSide: MAX_SIDE });
  }
  const turn = straightenAngle(img);
  if (turn) img = rotateImage(img, turn);
  img = cropToContent(img, 0.03);
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  if (k < 1) {
    const out = await page.evaluate(
      async ({ b64: src, w, h, nw, nh }) => {
        const bytes = Uint8ClampedArray.from(atob(src), (c) => c.charCodeAt(0));
        const a = document.createElement('canvas');
        a.width = w;
        a.height = h;
        a.getContext('2d').putImageData(new ImageData(bytes, w, h), 0, 0);
        const b = document.createElement('canvas');
        b.width = nw;
        b.height = nh;
        const ctx = b.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(a, 0, 0, nw, nh);
        const d = ctx.getImageData(0, 0, nw, nh).data;
        let s = '';
        for (let i = 0; i < d.length; i += 8192) s += String.fromCharCode(...d.subarray(i, i + 8192));
        return btoa(s);
      },
      { b64: Buffer.from(img.data.buffer).toString('base64'), w: img.width, h: img.height, nw: Math.round(img.width * k), nh: Math.round(img.height * k) }
    );
    img = { data: new Uint8ClampedArray(Buffer.from(out, 'base64')), width: Math.round(img.width * k), height: Math.round(img.height * k) };
  }

  if (Math.min(img.width, img.height) < 450) fail(`The garment is only ${img.width}x${img.height} pixels in this photo. Use a bigger photo (the garment should be at least 1000 pixels wide) so patterns stay sharp.`);

  // a garment that is dark or strongly coloured has little left to read once the colour is taken out
  let sum = 0;
  let n = 0;
  for (let i = 0; i < img.width * img.height; i += 5) {
    if (img.data[i * 4 + 3] > 200) {
      sum += 0.2126 * img.data[i * 4] + 0.7152 * img.data[i * 4 + 1] + 0.0722 * img.data[i * 4 + 2];
      n++;
    }
  }
  if (n && sum / n < 110) console.warn(`Note: this garment is quite dark (average brightness ${Math.round(sum / n)} of 255). Folds read best on white, cream or light grey cloth.`);

  const tpl = makeTemplate(img);
  const png = await page.evaluate(
    async ({ b64: src, w, h }) => {
      const bytes = Uint8ClampedArray.from(atob(src), (c) => c.charCodeAt(0));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').putImageData(new ImageData(bytes, w, h), 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    },
    { b64: Buffer.from(tpl.data.buffer).toString('base64'), w: tpl.width, h: tpl.height }
  );
  const dest = path.join(dir, entry.type, `${entry.id}.png`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(png, 'base64'));

  const indexPath = path.join(dir, 'index.json');
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : { templates: [] };
  index.templates = index.templates.filter((e) => !(e.type === entry.type && e.id === entry.id));
  index.templates.push(entry);
  index.templates.sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  const bad = indexProblems(index);
  if (bad.length) fail(`index.json would be invalid:\n - ${bad.join('\n - ')}`);
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Added ${entry.type}/${entry.id} (${tpl.width}x${tpl.height}, ${(png.length * 0.75 / 1024).toFixed(0)} KB). Check it with: npm run template:check`);
} finally {
  await browser.close();
}
