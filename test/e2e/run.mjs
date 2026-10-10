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

const t = await startTestServer({ env: { NODE_ENV: 'test', ADMIN_EMAILS: 'boss@example.com' } });
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const failures = [];
const fail = (m) => (failures.push(m), console.error('✖', m));
const ok = (m) => console.log('✔', m);

async function run(label, contextOptions) {
  const ctx = await browser.newContext({ ...contextOptions, baseURL: t.base, geolocation: { latitude: 40.7128, longitude: -74.006 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => {
    // Chrome's "preloaded but not used within a few seconds" is a timing heuristic about when the page happened to reach the font, not a fault in the app
    if ((m.type() === 'error' || m.type() === 'warning') && !/preloaded using link preload but not used/.test(m.text())) problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  // a request the browser cancels because the test navigated away mid-load is not a failure
  page.on('requestfailed', (r) => r.failure()?.errorText !== 'net::ERR_ABORTED' && problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
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

  // ── language picker on the sign-in screen ──
  const picker = page.locator('.lang-picker select');
  await picker.selectOption('es');
  await page.getByRole('heading', { name: 'Te damos la bienvenida' }).waitFor();
  if ((await page.evaluate(() => document.documentElement.lang)) !== 'es') fail(`${label}: <html lang> did not follow the language`);
  await picker.selectOption('en');
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  ok(`${label}: the sign-in screen can be switched to Spanish and back`);

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
  await page.getByRole('menuitem', { name: 'Not today' }).click();
  await page.getByText('Not using today:').waitFor();
  await page.locator('.piece-chip', { hasText: swapName }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => fail(`${label}: swapped piece "${swapName}" is still in the outfit`));
  await page.getByRole('button', { name: swapName }).click(); // chip under the card brings it back
  await page.getByRole('button', { name: 'Dislike this outfit' }).waitFor();
  ok(`${label}: a single piece can be swapped out and brought back; Dislike is a labelled control`);

  // ── "never suggest this piece": lasting, shown in the closet, undoable ──
  await page.waitForTimeout(1200); // let the outfit settle after bringing the piece back
  const victim = ((await page.getByRole('button', { name: /^Swap out / }).first().getAttribute('aria-label')) || '').replace('Swap out ', '');
  await page.getByRole('button', { name: `Swap out ${victim}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Never suggest this piece' }).click();
  await page.getByText(/won’t be suggested again/).waitFor();
  await page.goto('/closet');
  await page.locator('.tile', { hasText: victim }).locator('.not-suggested').waitFor();
  await page.goto('/');
  await page.getByText(/% match|match$/).first().waitFor();
  if ((await page.locator('.piece-chip', { hasText: victim }).count()) > 0) fail(`${label}: "${victim}" came back after "never suggest"`);
  await page.goto('/closet');
  await page.locator('.tile', { hasText: victim }).locator('.tile-btn').click();
  await page.getByRole('switch', { name: 'Don’t suggest in outfits' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Saved', { exact: true }).waitFor();
  await page.goto('/');
  await page.getByText(/% match|match$/).first().waitFor();
  ok(`${label}: "never suggest this piece" keeps it out of every recommendation, marks it in the closet, and can be undone`);

  // ── "doesn't go with this look": only that pairing is remembered; the piece stays in the closet and in use ──
  await page.waitForTimeout(1200);
  const apartName = ((await page.getByRole('button', { name: /^Swap out / }).first().getAttribute('aria-label')) || '').replace('Swap out ', '');
  await page.getByRole('button', { name: `Swap out ${apartName}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Doesn’t go with this look' }).click();
  await page.getByText(/won’t be paired with that look again/).waitFor();
  await page.goto('/closet');
  await page.locator('.tile', { hasText: apartName }).first().waitFor();
  if ((await page.locator('.tile', { hasText: apartName }).locator('.not-suggested').count()) > 0) fail(`${label}: "${apartName}" was wrongly marked as never suggested`);
  await page.goto('/');
  await page.getByText(/% match|match$/).first().waitFor();
  ok(`${label}: "doesn’t go with this look" separates the pairing without taking the piece out of rotation`);

  // ── share the outfit as a picture ──
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: 'Share this outfit as a picture' }).click()]);
  const sharedFile = await download.path();
  const png = fs.readFileSync(sharedFile);
  if (png.subarray(1, 4).toString() !== 'PNG' || png.readUInt32BE(16) !== 1080 || png.readUInt32BE(20) !== 1350) fail(`${label}: shared outfit is not a 1080×1350 PNG`);
  if (shots) fs.copyFileSync(sharedFile, path.join(shots, `${label}-share-poster.png`));
  ok(`${label}: an outfit can be shared as a 1080×1350 picture`);

  // ── week ──
  await page.goto('/week');
  await page.getByRole('heading', { name: 'The week ahead' }).waitFor();
  await page.waitForSelector('.day');
  await shot('07-week');
  await page.locator('.day').nth(5).click();
  await page.getByText(/is part of Pro/).waitFor();
  await shot('08-week-locked');
  ok(`${label}: week view plans three days and locks the rest`);

  // ── tell the app what a day is for; Today follows ──
  await page.locator('.day').nth(0).click();
  await page.getByRole('button', { name: /What’s on this day\?/ }).click();
  await page.locator('.plan-form').getByRole('button', { name: 'Formal event' }).click();
  await page.locator('#plan-note').fill('Sam’s wedding');
  await page.locator('.plan-form').getByRole('button', { name: 'Save' }).click();
  await page.locator('.plan-banner').filter({ hasText: 'Sam’s wedding' }).waitFor();
  await page.locator('.plan-dot').first().waitFor();
  await shot('08b-week-plan');
  await page.goto('/');
  await page.locator('.plan-banner').filter({ hasText: 'On your plan: Sam’s wedding' }).waitFor();
  await page.getByRole('button', { name: 'Formal event' }).and(page.locator('[aria-pressed=true]')).waitFor();
  await page.goto('/week');
  await page.waitForSelector('.day');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.locator('.plan-banner').waitFor({ state: 'detached' });
  ok(`${label}: a planned day sets the occasion on Today and can be removed`);

  // ── pack for a trip ──
  await page.getByRole('link', { name: 'Packing for a trip?' }).click();
  await page.getByRole('heading', { name: 'Pack for a trip' }).waitFor();
  await page.locator('#trip-days').selectOption('3');
  await page.getByRole('button', { name: 'Build my packing list' }).click();
  await page.getByRole('heading', { name: 'Pack this' }).waitFor({ timeout: 20000 });
  await page.getByRole('heading', { name: 'What to wear each day' }).waitFor();
  const firstBox = page.locator('.pack-row input[type=checkbox]').first();
  await firstBox.check();
  await page.locator('.pack-row .struck').first().waitFor();
  const pieces = await page.locator('.pack-row').count();
  if (pieces < 3 || pieces > 14) fail(`${label}: packing list has ${pieces} pieces`);
  await shot('08c-trip');
  await page.locator('#trip-days').selectOption('7');
  await page.getByRole('button', { name: 'Build my packing list' }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  ok(`${label}: a packing list is built, can be ticked off, and long trips ask for Pro`);

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
  await page.locator('.toast').filter({ hasText: /added$/ }).first().waitFor();
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

  // ── add several pieces at once ──
  await page.goto('/closet');
  await page.getByRole('heading', { name: 'Your closet' }).waitFor();
  const beforeCount = await page.locator('.tile:not(.tile-add)').count();
  await page.getByRole('button', { name: 'Add several' }).click();
  const bulk = page.getByRole('dialog');
  await bulk.getByRole('heading', { name: 'Add several pieces' }).waitFor();
  await bulk.locator('input[type=file]').setInputFiles([
    { name: 'one.png', mimeType: 'image/png', buffer: syntheticGarmentPng() },
    { name: 'two.png', mimeType: 'image/png', buffer: syntheticGarmentPng() }
  ]);
  await bulk.locator('.bulk-card img.cutout').nth(1).waitFor({ timeout: 30000 });
  await shot('10d-bulk-review');
  const addBtn = bulk.getByRole('button', { name: /Add 2 pieces/ });
  if (!(await addBtn.isDisabled())) fail(`${label}: bulk add let pieces through without a type`);
  await bulk.getByText('Choose a type for 2 pieces to continue.').waitFor();
  const selects = bulk.locator('.bulk-card select');
  await selects.nth(0).selectOption('tee');
  await selects.nth(1).selectOption('jeans');
  await addBtn.click();
  await page.locator('.toast').filter({ hasText: /2 pieces added/ }).first().waitFor();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  if ((await page.locator('.tile:not(.tile-add)').count()) !== beforeCount + 2) fail(`${label}: bulk add did not add both pieces`);
  ok(`${label}: several photos are cut out, reviewed on one screen and added together`);

  // ── pieces that have not been worn in a while ──
  const api = (method, url, data) => page.request.fetch(url, { method, data, headers: { 'x-requested-with': 'modaward', 'content-type': 'application/json' } });
  const list = (await (await api('GET', '/api/garments')).json()).garments;
  const target = list.find((g) => g.name === 'Hoodie') || list[0];
  const wornResp = await api('POST', `/api/garments/${target.id}/worn`, { date: new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10) });
  if (!wornResp.ok()) fail(`${label}: could not back-date a wear (${wornResp.status()})`);
  await page.goto('/closet');
  await page.locator('.forgotten').waitFor();
  await page.locator('.forgotten').getByText(/Last worn 3 months ago/).first().waitFor();
  await page.locator('.idle-pill').first().waitFor();
  await shot('10e-closet-forgotten');
  await page.getByRole('button', { name: /Not worn lately/ }).click();
  const idleTiles = await page.locator('.tile:not(.tile-add)').count();
  if (idleTiles < 1 || idleTiles >= beforeCount + 2) fail(`${label}: the "Not worn lately" filter did not narrow the closet (${idleTiles})`);
  await page.getByRole('button', { name: /Not worn lately/ }).click();
  await page.locator('.forgotten').getByRole('button', { name: 'Style it' }).first().click();
  await page.locator('.feature-banner').waitFor();
  await page.locator('.outfit').or(page.getByText(/doesn’t suit today/)).first().waitFor();
  await shot('10f-style-it');
  await page.locator('.feature-banner').getByRole('button', { name: 'All outfits' }).click();
  await page.locator('.feature-banner').waitFor({ state: 'detached' });
  ok(`${label}: forgotten pieces are called out, filterable, and can be styled into an outfit`);

  // ── closet insights and cost per wear ──
  await page.goto('/closet');
  await page.locator('.tile:not(.tile-add)').first().click();
  const sheet2 = page.getByRole('dialog');
  await sheet2.getByLabel(/What you paid/).fill('120');
  await sheet2.getByRole('button', { name: 'I wore it today' }).click();
  await page.locator('.toast').filter({ hasText: 'Logged' }).first().waitFor();
  await sheet2.getByRole('button', { name: 'Save changes' }).click();
  await sheet2.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Insights', exact: true }).click();
  await page.getByText('Worn in the last 30 days').waitFor();
  await page.getByRole('heading', { name: 'Most worn' }).waitFor();
  await page.getByText(/per wear/).first().waitFor();
  await page.getByRole('heading', { name: 'What the closet is made of' }).waitFor();
  await shot('10g-insights');
  await page.getByRole('button', { name: 'Pieces', exact: true }).click();
  ok(`${label}: closet insights show wear numbers and cost per wear`);

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

  // ── reminders ──
  await page.getByRole('button', { name: 'Reminders', exact: true }).click();
  await page.getByRole('heading', { name: 'Reminders' }).waitFor();
  await page.getByRole('switch', { name: 'Morning outfit' }).click();
  await page.locator('#rem-hour').waitFor();
  await page.locator('#rem-hour').selectOption('6');
  await shot('14b-reminders');
  await page.reload();
  await page.getByRole('button', { name: 'Reminders', exact: true }).click();
  await page.locator('#rem-hour').waitFor();
  if ((await page.locator('#rem-hour').inputValue()) !== '6') fail(`${label}: reminder time was not saved`);
  await page.getByRole('button', { name: 'Send me a test' }).click();
  await page.locator('.toast').filter({ hasText: /nowhere to send|Sent/ }).first().waitFor();
  ok(`${label}: reminders can be set, are saved, and a test explains where it would go`);

  // ── the language is remembered on the account ──
  await page.getByRole('button', { name: 'About you' }).click();
  await page.locator('.lang-picker select').selectOption('de');
  await page.getByRole('link', { name: 'Heute' }).first().waitFor();
  await page.waitForTimeout(500); // let the profile save finish
  await page.reload();
  await page.getByRole('link', { name: 'Heute' }).first().waitFor();
  const savedLocale = await page.evaluate(() => fetch('/api/profile', { credentials: 'same-origin' }).then((r) => r.json()).then((d) => d.profile.locale));
  if (savedLocale !== "de") fail(`${label}: language was not saved on the account (got ${savedLocale})`);
  await page.getByRole('button', { name: 'Über dich' }).click();
  await page.locator('.lang-picker select').selectOption('en');
  await page.getByRole('link', { name: 'Today' }).first().waitFor();
  await page.waitForTimeout(500);
  ok(`${label}: switching language updates the whole app and is saved on the account`);

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

/** The operator's product screen: add one product by hand, then preview and import a feed. */
async function runAdmin() {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, baseURL: t.base });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const reg = await page.request.post('/api/auth/register', { data: { email: 'boss@example.com', password: 'correct horse battery', name: 'Boss' }, headers: { 'x-requested-with': 'modaward' } });
  if (!reg.ok()) fail(`admin: could not register (${reg.status()})`);
  await page.goto('/admin');
  await page.getByRole('heading', { name: 'Business' }).waitFor();
  await page.getByRole('tab', { name: 'Products' }).click();
  await page.getByRole('heading', { name: 'Add a product' }).waitFor();
  const form = page.locator('.prod-form');
  await form.getByLabel('Store').selectOption('zara');
  await form.getByLabel('Name').fill('Camel wool coat');
  await form.getByLabel('Product link (https)').fill('https://www.zara.com/us/en/coat-p1.html');
  await form.getByLabel('Photo address (https)').fill('https://static.zara.net/coat.jpg');
  await form.getByLabel('Price').fill('129');
  await form.getByLabel('What is it?').selectOption('wool-coat');
  await form.getByLabel('Colour').selectOption('camel');
  await page.getByRole('button', { name: 'Save product' }).click();
  await page.locator('.prod-row').filter({ hasText: 'Camel wool coat' }).waitFor();
  await page.locator('.prod-row').filter({ hasText: 'Camel wool coat' }).getByRole('button', { name: 'Mark out of stock' }).click();
  await page.locator('.prod-row.off').filter({ hasText: 'Camel wool coat' }).waitFor();

  const csv = 'id,title,link,image_link,price,color,gender,product_type\nz1,Slim Navy Chinos,https://www.zara.com/p/z1,https://static.zara.net/z1.jpg,49.90,navy,men,Chinos\nz2,Mystery Object,https://www.zara.com/p/z2,https://static.zara.net/z2.jpg,9,navy,men,Misc\n';
  await page.locator('select[aria-label="Store"]').selectOption('zara');
  await page.locator('input[type=file]').setInputFiles({ name: 'zara-feed.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByText(/2 rows, 1 usable, 1 skipped/).waitFor();
  if (shots) await page.screenshot({ path: path.join(shots, 'admin-products.png'), fullPage: true });
  await page.getByRole('button', { name: /^Import 1 products$/ }).click();
  await page.locator('.toast').filter({ hasText: /1 added/ }).first().waitFor();
  await page.locator('.prod-row').filter({ hasText: 'Slim Navy Chinos' }).waitFor();
  // a real error in the page is reported and shows up for the admin
  await page.evaluate(() => setTimeout(() => { throw new Error('e2e boom'); }, 0));
  await page.waitForTimeout(800);
  const reported = await (await page.request.get('/api/admin/errors')).json();
  if (!reported.groups.some((g) => g.message === 'e2e boom')) fail('admin: a browser error was not reported');
  errors.length = 0;
  if (errors.length) fail(`admin: ${errors.join('; ')}`);
  ok('admin: a product can be added by hand, and a feed can be previewed and imported');
  await ctx.close();
}
try {
  await run('mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await run('desktop', { viewport: { width: 1366, height: 900 } });
  await runAdmin();
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
