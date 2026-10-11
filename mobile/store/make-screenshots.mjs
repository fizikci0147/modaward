#!/usr/bin/env node
/**
 * Store screenshots for the App Store and Google Play, made from the real app.
 *
 *   node mobile/store/make-screenshots.mjs [outputFolder]      (default: dist/store-screenshots)
 *
 * It starts the app with a demo account (a starter wardrobe, a style profile, some wear history), opens each
 * screen the way the iOS and Android apps show it (so nothing offers a purchase), captures it at the exact pixel
 * size each store wants, and also lays it out with a headline on a branded background.
 *
 * Needs the main project installed (npm install in the project folder) and Chromium (set CHROMIUM_PATH if it is
 * not found). The weather in the pictures is the test server's sample weather, so no real forecast is shown.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startTestServer, NYC } from '../../test/helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const out = path.resolve(process.argv[2] || path.join(repo, 'dist', 'store-screenshots'));

const executablePath =
  process.env.CHROMIUM_PATH ||
  (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(fs.existsSync) : undefined);

/** Each target: the size of the screen in CSS pixels, the pixel ratio, and so the exact size the store wants. */
const DEVICES = [
  { id: 'iphone-6.9in', store: 'Apple', label: 'iPhone 6.9 inch (1320×2868)', css: [440, 956], scale: 3, kind: 'phone', os: 'ios', top: 54, bottom: 34 },
  { id: 'iphone-6.5in', store: 'Apple', label: 'iPhone 6.5 inch (1284×2778)', css: [428, 926], scale: 3, kind: 'phone', os: 'ios', top: 50, bottom: 34 },
  { id: 'ipad-13in', store: 'Apple', label: 'iPad 13 inch (2064×2752)', css: [1032, 1376], scale: 2, kind: 'tablet', os: 'ios', top: 24, bottom: 20 },
  { id: 'android-phone', store: 'Google', label: 'Android phone (1080×1920)', css: [360, 640], scale: 3, kind: 'phone', os: 'android', top: 28, bottom: 18 },
  { id: 'android-tablet-10in', store: 'Google', label: 'Android 10-inch tablet (1600×2560)', css: [800, 1280], scale: 2, kind: 'tablet', os: 'android', top: 28, bottom: 18 }
];

const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 ModaWardApp',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 ModaWardApp'
};

const GREEN = '#1f3d33';
const CREAM = '#f6f3ed';
const INK = '#161511';

const SCREENS = [
  {
    id: 'today',
    title: 'Dress for the day ahead',
    sub: 'Outfits from your own closet and the hour-by-hour forecast',
    async shoot(page) {
      await page.goto('/');
      await page.waitForSelector('.outfit-board svg.art');
      await page.getByRole('region', { name: 'Weather' }).waitFor();
    },
    // the outfit is the point of this screen: bring it up under the status bar
    async frame(page) {
      await page.evaluate(() => {
        const board = document.querySelector('.outfit-board');
        const header = document.querySelector('.topbar');
        const below = header ? header.getBoundingClientRect().bottom : 100;
        // the occasion chips sit just above the outfit; leave them room under the header
        window.scrollTo(0, board.getBoundingClientRect().top + window.scrollY - (below + 92));
      });
    }
  },
  {
    id: 'week',
    title: 'Plan the week at a glance',
    sub: 'Every day’s forecast, with a look to match',
    async shoot(page) {
      await page.goto('/week');
      await page.waitForSelector('.day');
      await page.waitForSelector('.outfit-board svg.art');
    }
  },
  {
    id: 'closet',
    title: 'Your whole closet in your pocket',
    sub: 'Add pieces with a photo. The background is removed for you',
    async shoot(page) {
      await page.goto('/closet');
      await page.waitForSelector('.tile');
    }
  },
  {
    id: 'shop',
    title: 'Looks to shop, made for your taste',
    sub: 'Complete looks from the stores you choose',
    async shoot(page) {
      await page.goto('/shop');
      await page.waitForSelector('.look');
      await page.waitForTimeout(600);
    }
  },
  {
    id: 'style',
    title: 'Tell us your style once',
    sub: 'A one-minute quiz, and it keeps learning',
    async shoot(page) {
      await page.goto('/welcome?quiz=1');
      await page.getByRole('heading', { name: 'Let’s start with you' }).waitFor();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('heading', { name: /style\?/ }).waitFor();
      for (const name of ['Classic', 'Minimalist']) await page.getByRole('group', { name: new RegExp(`feel about ${name}`) }).getByRole('button', { name: 'Love' }).click();
      await page.waitForTimeout(500);
    }
  },
  {
    id: 'trip',
    title: 'Pack for any trip',
    sub: 'A packing list and a look for every day',
    async shoot(page) {
      await page.goto('/trip');
      await page.getByRole('heading', { name: 'Pack for a trip' }).waitFor();
      await page.locator('#trip-days').selectOption('3');
      await page.getByRole('button', { name: 'Build my packing list' }).click();
      await page.getByRole('heading', { name: 'Pack this' }).waitFor({ timeout: 20000 });
      await page.locator('.pack-row input[type=checkbox]').first().check();
      await page.waitForTimeout(400);
    }
  },
  {
    id: 'insights',
    title: 'Wear more of what you own',
    sub: 'See what you forget and what each piece costs per wear',
    async shoot(page) {
      await page.goto('/closet');
      await page.waitForSelector('.tile');
      await page.getByRole('button', { name: 'Insights', exact: true }).click();
      await page.getByText('Worn in the last 30 days').waitFor();
      await page.getByText(/per wear/).first().waitFor();
    }
  }
];

// ─────────────────────────────────────────── the demo account
async function seedDemo(t) {
  const c = t.client();
  const reg = await c.post('/api/auth/register', { email: 'mia@example.com', password: 'correct horse battery', name: 'Mia', acceptTerms: true });
  if (reg.status !== 201) throw new Error(`could not create the demo account: ${reg.status} ${reg.text}`);
  const id = reg.json.user.id;
  const must = (res, what) => {
    if (res.status >= 300) throw new Error(`demo setup failed at ${what}: ${res.status} ${res.text.slice(0, 200)}`);
    return res;
  };
  must(await c.patch('/api/profile', {
    location: NYC,
    department: 'women',
    style: { archetypes: { minimal: 1, classic: 0.9, polished: 0.8, casual: 0.5 }, likedColors: ['navy', 'cream', 'camel', 'olive'], quizDone: true },
    lifestyle: { occasions: ['work', 'casual', 'date'] }
  }), 'the style profile');
  must(await c.post('/api/garments/starter', { department: 'women' }), 'the starter wardrobe');
  // everything from Today to the Insights screen is open to a Pro member
  t.deps.repos.users.setPlan(id, { plan: 'pro', status: 'active', renewsAt: Math.floor(Date.now() / 1000) + 200 * 86400 });
  const garments = (await c.get('/api/garments')).json.garments;
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const prices = [64, 38, 120, 89, 210, 45, 59, 150, 32, 95, 78, 180, 55, 110];
  for (const [i, g] of garments.entries()) {
    must(await c.patch(`/api/garments/${g.id}`, { price: prices[i % prices.length] }), 'a price');
    // some pieces worn a lot, some a little, a few not for months (so the "forgotten" and cost-per-wear numbers are real)
    const times = [9, 7, 6, 5, 4, 3, 2, 2, 1, 1, 0, 0, 3, 5][i % 14];
    for (let k = 0; k < times; k++) must(await c.post(`/api/garments/${g.id}/worn`, { date: day(1 + k * 3 + (i % 3)) }), 'a wear');
  }
  return c;
}

// ─────────────────────────────────────────── drawing
const b64 = (file) => fs.readFileSync(path.join(repo, 'public', 'fonts', file)).toString('base64');
const FONTS = `
@font-face{font-family:'Instrument Serif';src:url(data:font/woff2;base64,${b64('instrument-serif-400.woff2')}) format('woff2');font-weight:400}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(data:font/woff2;base64,${b64('instrument-serif-400-italic.woff2')}) format('woff2');font-weight:400}
@font-face{font-family:'Geist';src:url(data:font/woff2;base64,${b64('geist-latin.woff2')}) format('woff2');font-weight:100 900}`;

const LOGO = (color) => `<svg viewBox="0 0 32 32" fill="none" stroke="${color}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10.2V8.6a2.9 2.9 0 1 0-2.9-2.9"/><path d="M16 10.2 4.6 19.2a2.1 2.1 0 0 0 1.3 3.8h20.2a2.1 2.1 0 0 0 1.3-3.8L16 10.2Z"/><path d="M16 26.3s2.4-2.5 2.4-4a2.4 2.4 0 0 0-4.8 0c0 1.5 2.4 4 2.4 4Z" fill="#e0825f" stroke="none"/></svg>`;

/** A status bar and home indicator drawn over the page, as on a real phone (the capture has none of its own). */
const chrome = (d) => {
  const dark = false;
  const fg = dark ? '#fff' : '#111';
  const ios = d.os === 'ios';
  const bar = `<div style="position:fixed;left:0;right:0;top:0;height:${d.top}px;z-index:99999;pointer-events:none;background:${CREAM};display:flex;align-items:${d.kind === 'phone' ? 'flex-end' : 'center'};justify-content:space-between;padding:0 ${d.kind === 'phone' ? 28 : 26}px ${d.kind === 'phone' ? 8 : 0}px;font:600 ${ios ? 16 : 13}px/1 -apple-system,'Segoe UI',Roboto,sans-serif;color:${fg}">
    <span>${ios ? '9:41' : '9:41'}</span>
    <span style="display:flex;gap:6px;align-items:center">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="${fg}"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="${fg}" stroke-width="1.8" stroke-linecap="round"><path d="M1.5 4.2a10 10 0 0 1 14 0M4 7a6.5 6.5 0 0 1 9 0"/><circle cx="8.5" cy="10" r="1.2" fill="${fg}" stroke="none"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x=".7" y=".7" width="22" height="11.6" rx="3.4" stroke="${fg}" opacity=".45"/><rect x="2.2" y="2.2" width="19" height="8.6" rx="2" fill="${fg}"/><path d="M24.5 4.4v4.2c.9-.3 1.5-1.2 1.5-2.1s-.6-1.8-1.5-2.1Z" fill="${fg}" opacity=".5"/></svg>
    </span></div>`;
  const home = ios && d.kind === 'phone' ? `<div style="position:fixed;left:50%;bottom:8px;transform:translateX(-50%);width:${Math.round(d.css[0] * 0.3)}px;height:5px;border-radius:3px;background:${fg};opacity:.9;z-index:99999;pointer-events:none"></div>` : '';
  return bar + home;
};

async function capture(browser, base, state, d, screen) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width: d.css[0], height: d.css[1] },
    deviceScaleFactor: d.scale,
    isMobile: true,
    hasTouch: true,
    userAgent: UA[d.os],
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'light',
    bypassCSP: true, // only so the status bar we draw over the capture can be styled
    storageState: state // already signed in as the demo account
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-06T14:30:00Z')); // 10:30 in New York, the day the sample forecast covers
  // the safe areas a real phone reports (the app reads these)
  await page.addInitScript(`document.addEventListener('DOMContentLoaded',()=>{const r=document.documentElement.style;r.setProperty('--safe-area-inset-top','${d.top}px');r.setProperty('--safe-area-inset-bottom','${d.bottom}px')})`);
  await page.addInitScript(`try{localStorage.setItem('mw-trial-note-dismissed','1')}catch(e){}`);
  try {
    await screen.shoot(page);
  } catch (e) {
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, `_failed-${d.id}-${screen.id}.png`) }).catch(() => {});
    throw new Error(`${d.id} / ${screen.id}: ${e.message.split('\n')[0]} (see _failed-${d.id}-${screen.id}.png)`);
  }
  await page.waitForTimeout(700);
  if (screen.frame) await screen.frame(page, d);
  else await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.evaluate((html) => document.body.insertAdjacentHTML('beforeend', html), chrome(d));
  const png = await page.screenshot({ type: 'png' });
  await ctx.close();
  return png;
}

/** The screenshot in a phone or tablet frame under a headline, at exactly the store's size. */
function layout({ W, H, d, png, title, sub, dark, size }) {
  const a = d.css[1] / d.css[0];
  const phone = d.kind === 'phone';
  const frameW = Math.min(W * (phone ? 0.84 : 0.8), (H * 0.79) / (0.944 * a + 0.056));
  const b = frameW * (phone ? 0.028 : 0.024);
  const screenW = frameW - 2 * b;
  const screenH = screenW * a;
  const frameH = screenH + 2 * b;
  const radius = frameW * (phone ? 0.145 : 0.05);
  const bg = dark ? GREEN : CREAM;
  const fg = dark ? CREAM : INK;
  const muted = dark ? 'rgba(246,243,237,.78)' : '#57534a';
  const head = H * (phone ? 0.06 : 0.055);
  const titleSize = W * (phone ? 0.082 : 0.058);
  const subSize = W * (phone ? 0.038 : 0.026);
  const island = phone && d.os === 'ios' ? `<div style="position:absolute;left:50%;top:${screenW * 0.026}px;transform:translateX(-50%);width:${screenW * 0.28}px;height:${screenW * 0.082}px;border-radius:99px;background:#000"></div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;background:${bg};color:${fg};overflow:hidden;font-family:'Geist',sans-serif;position:relative}
.bg{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 100%,${dark ? 'rgba(224,130,95,.16)' : 'rgba(31,61,51,.10)'} 0%,transparent 60%)}
.head{position:absolute;left:0;right:0;top:${head}px;text-align:center;padding:0 ${W * 0.08}px}
h1{font-family:'Instrument Serif',serif;font-weight:400;font-size:${titleSize}px;line-height:1.04;letter-spacing:-.02em}
p{margin-top:${titleSize * 0.22}px;font-size:${subSize}px;line-height:1.35;color:${muted}}
.logo{position:absolute;left:${W * 0.05}px;top:${H * 0.022}px;display:flex;align-items:center;gap:${W * 0.012}px;font-family:'Instrument Serif',serif;font-size:${W * 0.04}px;opacity:.9}
.logo svg{width:${W * 0.04}px;height:${W * 0.04}px}
.frame{position:absolute;left:50%;transform:translateX(-50%);bottom:${H * 0.035}px;width:${frameW}px;height:${frameH}px;border-radius:${radius}px;background:#0c0c0c;padding:${b}px;box-shadow:0 ${H * 0.012}px ${H * 0.04}px rgba(0,0,0,.35),inset 0 0 0 ${Math.max(2, b * 0.12)}px #2a2a2a}
.screen{position:relative;width:${screenW}px;height:${screenH}px;border-radius:${radius - b}px;overflow:hidden;background:#fff}
.screen img{width:100%;height:100%;display:block}
</style></head><body><div class="bg"></div>
<div class="logo">${LOGO(fg)}ModaWard</div>
<div class="head"><h1>${title}</h1><p>${sub}</p></div>
<div class="frame"><div class="screen"><img src="data:image/png;base64,${png.toString('base64')}">${island}</div></div>
</body></html>`;
}

function featureGraphic(png) {
  const W = 1024;
  const H = 500;
  const a = 640 / 360;
  const frameW = 250;
  const b = 8;
  const screenW = frameW - 2 * b;
  const screenH = screenW * a;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;background:${GREEN};color:${CREAM};overflow:hidden;font-family:'Geist',sans-serif;position:relative}
.bg{position:absolute;inset:0;background:radial-gradient(80% 120% at 85% 100%,rgba(224,130,95,.25) 0%,transparent 60%)}
.copy{position:absolute;left:64px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;gap:18px}
.brand{display:flex;align-items:center;gap:12px;font-family:'Instrument Serif',serif;font-size:34px}
.brand svg{width:38px;height:38px}
h1{font-family:'Instrument Serif',serif;font-weight:400;font-size:84px;line-height:.98;letter-spacing:-.02em}
h1 i{font-style:italic}
p{font-size:23px;line-height:1.35;color:rgba(246,243,237,.8);max-width:470px}
.frame{position:absolute;right:70px;top:48px;width:${frameW}px;height:${screenH + 2 * b}px;border-radius:38px 38px 0 0;background:#0c0c0c;padding:${b}px ${b}px 0;box-shadow:0 20px 50px rgba(0,0,0,.4)}
.screen{width:${screenW}px;height:${screenH}px;border-radius:30px 30px 0 0;overflow:hidden}
.screen img{width:100%;display:block}
</style></head><body><div class="bg"></div>
<div class="copy"><div class="brand">${LOGO(CREAM)}ModaWard</div><h1>Dress for the day <i>ahead.</i></h1><p>Outfits from your own closet and the hour-by-hour forecast.</p></div>
<div class="frame"><div class="screen"><img src="data:image/png;base64,${png.toString('base64')}"></div></div>
</body></html>`;
}

// ─────────────────────────────────────────── go
fs.mkdirSync(out, { recursive: true });
const t = await startTestServer({ env: { SIGNUP_PRO_DAYS: '0' } });
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  await seedDemo(t);
  // sign in once (the app limits sign-in attempts) and reuse the session for every capture
  const boot = await browser.newContext({ baseURL: t.base });
  const login = await boot.request.post('/api/auth/login', { data: { email: 'mia@example.com', password: 'correct horse battery' }, headers: { 'x-requested-with': 'modaward' } });
  if (!login.ok()) throw new Error(`demo sign-in failed: ${login.status()}`);
  const state = await boot.storageState();
  await boot.close();
  const comp = await browser.newPage();
  const made = [];
  let cover = null;
  for (const d of DEVICES.filter((x) => !process.env.ONLY_DEVICE || x.id === process.env.ONLY_DEVICE)) {
    const W = d.css[0] * d.scale;
    const H = d.css[1] * d.scale;
    const rawDir = path.join(out, d.store, d.id, 'screens-only');
    const styledDir = path.join(out, d.store, d.id, 'with-headlines');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.mkdirSync(styledDir, { recursive: true });
    for (const [i, screen] of SCREENS.entries()) {
      if (process.env.ONLY_SCREEN && screen.id !== process.env.ONLY_SCREEN) continue;
      const png = await capture(browser, t.base, state, d, screen);
      const name = `${String(i + 1).padStart(2, '0')}-${screen.id}.png`;
      fs.writeFileSync(path.join(rawDir, name), png);
      await comp.setViewportSize({ width: W, height: H });
      await comp.setContent(layout({ W, H, d, png, title: screen.title, sub: screen.sub, dark: i % 2 === 1, size: [W, H] }));
      await comp.evaluate(() => document.fonts.ready);
      fs.writeFileSync(path.join(styledDir, name), await comp.screenshot({ type: 'png' }));
      if (d.id === 'android-phone' && screen.id === 'today') cover = png;
      made.push(`${d.store}/${d.id}/${name}`);
    }
    console.log(`✔ ${d.label}: ${SCREENS.length} screens`);
  }
  // Google Play also wants a 1024×500 feature graphic
  await comp.setViewportSize({ width: 1024, height: 500 });
  await comp.setContent(featureGraphic(cover));
  await comp.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.join(out, 'Google'), { recursive: true });
  fs.writeFileSync(path.join(out, 'Google', 'feature-graphic-1024x500.png'), await comp.screenshot({ type: 'png' }));
  console.log('✔ Google Play feature graphic (1024×500)');
  console.log(`\n${made.length} screenshots in ${out}`);
} finally {
  await browser.close();
  await t.close();
}
process.exit(0);
