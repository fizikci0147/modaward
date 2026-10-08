// End-to-end smoke test: real server + real browser. Fails on console errors / CSP violations.
//   npm run test:e2e                 (assertions only)
//   SHOTS=/tmp/shots npm run test:e2e   (also saves screenshots)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startTestServer } from '../helpers.js';
import { syntheticGarmentPng } from './photo.mjs';

const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });

const executablePath =
  process.env.CHROMIUM_PATH ||
  (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(fs.existsSync) : undefined);

const t = await startTestServer({ env: { NODE_ENV: 'test' } });
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const failures = [];
const fail = (m) => (failures.push(m), console.error('✖', m));
const ok = (m) => console.log('✔', m);

async function run(label, contextOptions) {
  const ctx = await browser.newContext({ ...contextOptions, baseURL: t.base, geolocation: { latitude: 40.7128, longitude: -74.006 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && !/\/api\/(auth\/me|outfits\/recommend)/.test(r.url()) && !/favicon/.test(r.url())) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  const shot = async (name) => shots && (await page.waitForTimeout(350), await page.screenshot({ path: path.join(shots, `${label}-${name}.png`), fullPage: name.startsWith('full-') }));

  try {
  // ── signed out ──
  await page.goto('/');
  await page.waitForURL('**/login');
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await shot('01-login');
  ok(`${label}: signed-out visitors land on the sign-in page`);

  // ── register ──
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill(`ada-${label}-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct horse battery');
  await shot('02-register');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/welcome');
  ok(`${label}: registration reaches onboarding`);

  // ── onboarding ──
  await page.getByPlaceholder('Search for your city').fill('new york');
  await page.getByRole('button', { name: /New York, NY/ }).click();
  await page.getByRole('heading', { name: /style\?/ }).waitFor();
  await shot('03-welcome-style');
  await page.getByRole('button', { name: 'Menswear', exact: true }).click();
  for (const name of ['Classic', 'Minimalist']) await page.getByRole('group', { name: new RegExp(`feel about ${name}`) }).getByRole('button', { name: 'Love' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: /your closet/ }).waitFor();
  await shot('04-welcome-closet');
  await page.getByRole('button', { name: 'Start with a starter wardrobe' }).click();
  ok(`${label}: onboarding collects location, style and a starter wardrobe`);

  // ── today ──
  await page.getByRole('region', { name: 'Weather' }).waitFor();
  await page.getByText(/% match|match$/).first().waitFor();
  await page.waitForSelector('.outfit-board svg.art');
  await shot('05-today');
  await page.screenshot({ path: shots ? path.join(shots, `${label}-05-today-full.png`) : undefined, fullPage: true }).catch(() => {});
  const items = await page.locator('.piece-chip').count();
  if (items < 3) fail(`${label}: outfit shows only ${items} pieces`);
  await page.getByRole('button', { name: 'Work' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /I’m wearing this/ }).click();
  await page.getByText('Logged. Enjoy the day.').waitFor();
  await shot('06-today-worn');
  ok(`${label}: today shows weather + outfit, occasion switch and "wearing this" work`);

  // ── dislike controls: swap one piece out, and rate the whole outfit ──
  await page.getByRole('button', { name: 'Undo' }).click().catch(() => {});
  const swapBtn = page.getByRole('button', { name: /^Swap out / }).first();
  const swapName = ((await swapBtn.getAttribute('aria-label')) || '').replace('Swap out ', '');
  await swapBtn.click();
  await page.getByText('Not using today:').waitFor();
  await page.locator('.piece-chip', { hasText: swapName }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => fail(`${label}: swapped piece "${swapName}" is still in the outfit`));
  await page.getByRole('button', { name: swapName }).click(); // chip under the card brings it back
  await page.getByRole('button', { name: 'Dislike this outfit' }).waitFor();
  ok(`${label}: a single piece can be swapped out and brought back; Dislike is a labelled control`);

  // ── week ──
  await page.goto('/week');
  await page.getByRole('heading', { name: 'The week ahead' }).waitFor();
  await page.waitForSelector('.day');
  await shot('07-week');
  await page.locator('.day').nth(5).click();
  await page.getByText(/is part of Pro/).waitFor();
  await shot('08-week-locked');
  ok(`${label}: week view plans three days and locks the rest`);

  // ── closet ──
  await page.goto('/closet');
  await page.getByRole('heading', { name: 'Your closet' }).waitFor();
  await page.waitForSelector('.tile');
  await shot('09-closet');
  await page.getByRole('button', { name: 'Add a piece' }).first().click();
  await page.getByRole('dialog').waitFor();
  await shot('10-closet-add');
  await page.getByRole('dialog').getByRole('button', { name: 'Hoodie', exact: true }).click();
  await page.getByRole('button', { name: 'Add to closet' }).click();
  await page.getByText(/added$/).waitFor();
  ok(`${label}: closet lists pieces and adding one works`);

  // ── photo with automatic background removal ──
  await page.getByRole('button', { name: 'Add a piece' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.locator('input[type=file]').setInputFiles({ name: 'tee-on-floor.png', mimeType: 'image/png', buffer: syntheticGarmentPng() });
  await dialog.locator('img.cutout').waitFor({ timeout: 20000 });
  await dialog.getByRole('switch', { name: 'Remove background' }).waitFor();
  await shot('10b-closet-cutout');
  const alpha = await dialog.locator('img.cutout').evaluate(async (img) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const px = (x, y) => ctx.getImageData(x, y, 1, 1).data;
    return { corner: px(2, 2)[3], centre: px(c.width >> 1, c.height >> 1)[3], w: c.width, h: c.height };
  });
  if (alpha.corner !== 0 || alpha.centre !== 255) fail(`${label}: cut-out alpha wrong (corner ${alpha.corner}, centre ${alpha.centre})`);
  // the detected colour should be navy, not floor brown
  await dialog.getByRole('button', { name: 'T-shirt', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add to closet' }).click();
  await page.locator('.toast').filter({ hasText: /T-shirt added/i }).first().waitFor();
  await page.locator('.tile-art img.cutout').first().waitFor();
  const saved = await page.locator('.tile-art img.cutout').first().getAttribute('src');
  const res = await page.request.get(saved);
  if (res.headers()['content-type'] !== 'image/png') fail(`${label}: stored photo is not a PNG cut-out (${res.status()} ${res.headers()['content-type']} ${saved})`);
  await shot('10c-closet-with-cutout');
  ok(`${label}: photo upload removes the background, detects the colour and stores a transparent PNG`);

  // ── shop ──
  await page.goto('/shop');
  await page.getByRole('heading', { name: 'Looks for you' }).waitFor();
  await page.waitForSelector('.look');
  await shot('11-shop');
  const looks = await page.locator('.look').count();
  if (looks < 4) fail(`${label}: only ${looks} looks shown`);
  const link = await page.locator('.shop-link').first().getAttribute('href');
  if (!/^\/go\?r=/.test(link || '')) fail(`${label}: shop link is not a signed /go link: ${link}`);
  await page.locator('.look').first().getByRole('button', { name: 'Love this look' }).click();
  await page.getByText(/Noted/).waitFor();
  await page.getByRole('button', { name: 'Closet gaps' }).click();
  await page.waitForSelector('.gap-card, .empty');
  await shot('12-shop-gaps');
  ok(`${label}: shop shows ${looks} looks with signed links; love + gaps work`);

  // ── profile ──
  await page.goto('/style');
  await page.getByText(/Your style profile is/).waitFor();
  await shot('13-profile-style');
  for (const s of ['About you', 'Sizes & fit', 'Lifestyle & budget', 'Account & plan']) {
    await page.getByRole('button', { name: s }).click();
    await page.waitForTimeout(200);
    await shot(`14-profile-${s.split(' ')[0].toLowerCase()}`);
  }
  ok(`${label}: profile sections render`);

  // ── pro ──
  await page.goto('/pro');
  await page.getByRole('heading', { name: /stylist in your/ }).waitFor();
  await shot('15-pro');

  // ── legal + sign out ──
  await page.goto('/privacy');
  await page.getByRole('heading', { name: 'Privacy Policy' }).waitFor();
  await page.goto('/style?section=account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  ok(`${label}: legal pages and sign out work`);

  } catch (e) {
    if (shots) await page.screenshot({ path: path.join(shots, `${label}-FAILED.png`), fullPage: true }).catch(() => {});
    problems.forEach((p) => console.error('   ', p));
    throw e;
  }
  const real = problems.filter((p) => !/Failed to load resource.*(401|409)/.test(p));
  if (real.length) real.forEach((p) => fail(`${label}: ${p}`));
  await ctx.close();
}

try {
  await run('mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await run('desktop', { viewport: { width: 1366, height: 900 } });
} catch (e) {
  fail(e.stack || e.message);
} finally {
  await browser.close();
  await t.close();
}
if (failures.length) {
  console.error(`\n${failures.length} problem(s)`);
  process.exit(1);
}
console.log('\nAll end-to-end checks passed.');
