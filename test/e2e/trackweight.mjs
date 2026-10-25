// End-to-end test of the calorie tracker page: real server (fake AI and food databases) + real browser,
// phone and desktop. Fails on console errors and CSP violations, like the main end-to-end test.
//   node test/e2e/trackweight.mjs                  (assertions only)
//   SHOTS=/tmp/shots node test/e2e/trackweight.mjs (also saves screenshots)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startTestServer } from '../helpers.js';

const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const executablePath =
  process.env.CHROMIUM_PATH ||
  (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(fs.existsSync) : undefined);

const MEAL = {
  items: [
    { name: 'Grilled chicken breast', grams: 150, kcal: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, confidence: 'high' },
    { name: 'White rice', grams: 200, kcal: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6, confidence: 'medium' }
  ],
  notes: 'Oil on the rice is hard to judge.'
};
const fakeAi = {
  requests: [],
  beta: { messages: { create: async (req) => (fakeAi.requests.push(req), { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(MEAL) }], usage: { input_tokens: 800, output_tokens: 200 } }) } }
};
const nutella = { code: '3017620422003', product_name: 'Nutella', brands: 'Ferrero', nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 }, serving_size: '15 g', serving_quantity: 15 };
const fakeFetch = async (url) => {
  const u = new URL(url);
  if (u.pathname.startsWith('/api/v2/product/')) return { ok: true, status: 200, json: async () => ({ status: 1, product: nutella }) };
  if (u.host === 'world.openfoodfacts.org') return { ok: true, status: 200, json: async () => ({ products: [nutella] }) };
  return { ok: true, status: 200, json: async () => ({ foods: [] }) };
};

const t = await startTestServer({ env: { NODE_ENV: 'test', PRICING: 'free', FREE_AI: '1' }, overrides: { aiClient: fakeAi, fetch: fakeFetch } });
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const failures = [];
const fail = (m) => (failures.push(m), console.error('✖', m));
const ok = (m) => console.log('✔', m);

async function run(label, contextOptions) {
  const ctx = await browser.newContext({ ...contextOptions, baseURL: t.base, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  const offline = { on: false, failed: [] };
  page.on('console', (m) => {
    if (offline.on && /ERR_INTERNET_DISCONNECTED/.test(m.text())) return; // checked below: only the online search may fail
    if ((m.type() === 'error' || m.type() === 'warning') && !/preloaded using link preload but not used/.test(m.text())) problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    if (r.failure()?.errorText === 'net::ERR_ABORTED') return;
    if (offline.on) offline.failed.push(new URL(r.url()).pathname);
    else problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => r.status() >= 400 && !/favicon/.test(r.url()) && problems.push(`HTTP ${r.status()} ${r.url()}`));
  const shot = async (name) => shots && (await page.waitForTimeout(300), await page.screenshot({ path: path.join(shots, `tw-${label}-${name}.png`), fullPage: name.startsWith('full-') }));
  const noSideScroll = async (where) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) fail(`${label}: the page scrolls sideways by ${over}px on ${where}`);
  };
  const diaryNumbers = async () => {
    const text = await page.locator('.tw-eq').innerText();
    const n = (word) => Number((text.match(new RegExp(`([\\d,]+)\\s*\\n?\\s*${word}`)) || [])[1]?.replace(/,/g, ''));
    return { goal: n('Goal'), food: n('Food'), exercise: n('Exercise') };
  };

  try {
    // ── first visit: a short profile ──
    await page.goto('/trackweight');
    await page.getByRole('heading', { name: 'Welcome to Track Weight' }).waitFor();
    if ((await page.title()) !== 'Track Weight · ModaWard') fail(`${label}: wrong title ${await page.title()}`);
    await shot('01-welcome');
    await noSideScroll('the welcome screen');
    await page.getByRole('button', { name: 'Male', exact: true }).click();
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.getByText('kcal left').waitFor();
    const start = await diaryNumbers();
    assert.ok(start.goal > 2000 && start.goal < 3000, `goal ${start.goal}`);
    assert.deepEqual([start.food, start.exercise], [0, 0]);
    await shot('02-diary-empty');
    ok(`${label}: first visit asks for a profile and shows a calorie goal (${start.goal} kcal)`);

    // ── library food ──
    await page.getByRole('button', { name: 'Add food' }).click();
    await page.getByRole('dialog', { name: 'Add food' }).waitFor();
    await page.getByRole('tab', { name: 'Search' }).waitFor();
    await page.getByLabel('Search foods').fill('banana');
    await page.getByRole('button', { name: /^Banana/ }).first().click();
    await page.getByText('105', { exact: false }).first().waitFor();
    await shot('03-portion');
    await page.getByRole('button', { name: 'Add to diary' }).click();
    await page.locator('.tw-entry', { hasText: 'Banana' }).waitFor();
    assert.equal((await diaryNumbers()).food, 105);
    ok(`${label}: a built-in food is added with its serving (banana = 105 kcal)`);

    // ── online database ──
    await page.getByRole('button', { name: 'Add food' }).click();
    await page.getByLabel('Search foods').fill('nutella');
    await page.getByText('Online databases').waitFor();
    await shot('04-online-search');
    await page.getByRole('button', { name: /Nutella/ }).first().click();
    await page.getByRole('button', { name: 'Add to diary' }).click();
    await page.locator('.tw-entry', { hasText: 'Nutella' }).waitFor();
    assert.equal((await diaryNumbers()).food, 105 + 81);
    ok(`${label}: an online-database food is found and added (Nutella, 1 serving = 81 kcal)`);

    // ── barcode (no camera in the test browser: typed number) ──
    await page.getByRole('button', { name: 'Add food' }).click();
    await page.getByRole('tab', { name: 'Barcode' }).click();
    await page.getByPlaceholder('Barcode number').fill('3017620422003');
    await page.getByRole('button', { name: 'Find' }).click();
    await page.getByRole('heading', { name: 'Nutella' }).waitFor();
    await page.getByLabel('Amount').fill('2');
    await page.getByRole('button', { name: 'Add to diary' }).click();
    await page.locator('.tw-entry', { hasText: 'Nutella' }).nth(1).waitFor();
    assert.equal((await diaryNumbers()).food, 105 + 81 + 162);
    ok(`${label}: a barcode finds the product and two servings are added`);

    // ── a food of one's own ──
    await page.getByRole('button', { name: 'Add food' }).click();
    await page.getByRole('tab', { name: 'Manual' }).click();
    await page.getByLabel('Food name').fill('Lentil soup');
    await page.getByLabel('Serving size (g)').fill('300');
    await page.getByLabel('Calories (kcal)').fill('240');
    await page.getByRole('button', { name: 'Add to diary' }).click();
    await page.locator('.tw-entry', { hasText: 'Lentil soup' }).waitFor();
    await page.getByRole('button', { name: 'Add food' }).click();
    await page.getByRole('button', { name: /Lentil soup/ }).first().waitFor(); // listed under "Recent and my foods"
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    ok(`${label}: a custom food is added and remembered under "my foods"; Escape closes the sheet`);

    // ── photo: signed out, then signed in ──
    await page.getByRole('button', { name: 'Add food' }).click();
    await page.getByRole('tab', { name: 'Photo' }).click();
    await page.getByText(/you need to be signed in/).waitFor();
    await page.getByRole('link', { name: 'Open ModaWard to sign in' }).waitFor();
    await shot('05-photo-signin');
    await page.keyboard.press('Escape');
    const reg = await ctx.request.post('/api/auth/register', { headers: { 'x-requested-with': 'modaward' }, data: { email: `tw-${Date.now()}@example.com`, password: 'correct horse battery', name: 'Tracker', acceptTerms: true } });
    assert.equal(reg.status(), 201);
    const jpeg = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1800; c.height = 1200;
      const g = c.getContext('2d');
      g.fillStyle = '#b45309'; g.fillRect(0, 0, 1800, 1200); g.fillStyle = '#fde68a'; g.beginPath(); g.arc(900, 600, 420, 0, 7); g.fill();
      return c.toDataURL('image/jpeg').split(',')[1];
    });
    await page.getByRole('button', { name: 'Add food' }).click();
    await page.getByRole('tab', { name: 'Photo' }).click();
    await page.getByText('Take a photo of your meal').waitFor();
    await page.setInputFiles('input[type=file]', { name: 'meal.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
    await page.getByLabel(/^Hint/).fill('chicken and rice');
    await page.getByRole('button', { name: 'Estimate calories' }).click();
    await page.getByText('Grilled chicken breast').waitFor();
    // the browser resized the 1800 px photo before sending it
    const sent = fakeAi.requests.at(-1).messages[0].content[0].source.data;
    const dims = await page.evaluate(
      (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = `data:image/jpeg;base64,${b64}`; }),
      sent
    );
    assert.equal(Math.max(...dims), 1280, `photo was sent at ${dims.join('x')}`);
    await page.locator('input[id^="tw-g-"]').nth(1).fill('100');
    await page.getByText('130', { exact: true }).waitFor(); // rice halves: 260 -> 130
    await shot('06-photo-result');
    await page.getByRole('button', { name: /Add 2 items/ }).click();
    await page.locator('.tw-entry', { hasText: 'White rice' }).waitFor();
    await page.getByText('photo estimate').first().waitFor();
    assert.equal((await diaryNumbers()).food, 105 + 81 + 162 + 240 + 248 + 130);
    ok(`${label}: a photo is resized, estimated, corrected (rice 200 g to 100 g) and added, labelled as an estimate`);

    // ── edit and delete an entry ──
    await page.locator('.tw-entry', { hasText: 'Banana' }).click();
    await page.getByRole('dialog', { name: 'Banana' }).waitFor();
    await page.getByLabel('Amount (g)').fill('236'); // 2 bananas
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('236 g').waitFor();
    await page.locator('.tw-entry', { hasText: 'Nutella' }).first().click();
    await page.getByRole('button', { name: 'Delete entry' }).click();
    await page.locator('.tw-entry', { hasText: 'Nutella' }).nth(1).waitFor({ state: 'detached' });
    assert.equal((await diaryNumbers()).food, 210 + 162 + 240 + 248 + 130);
    ok(`${label}: an entry's amount can be changed and an entry deleted, totals follow`);
    await shot('07-diary-full');
    await shot('full-07-diary');
    await noSideScroll('the diary');

    // ── exercise ──
    await page.getByRole('button', { name: 'Exercise', exact: true }).click();
    await page.getByRole('heading', { name: 'Workouts' }).waitFor();
    await page.getByRole('button', { name: 'Log exercise' }).click();
    await page.getByRole('button', { name: /Running, 10 km\/h/ }).click();
    await page.getByLabel('Duration (minutes)').fill('30');
    await page.getByText(/MET 9\.8 × \d+ kg × 30 min/).waitFor();
    await shot('08-exercise');
    await page.getByRole('button', { name: 'Add workout' }).click();
    await page.locator('.tw-entry', { hasText: 'Running, 10 km/h' }).waitFor();
    await page.getByRole('button', { name: 'Diary', exact: true }).click();
    const withRun = await diaryNumbers();
    assert.ok(withRun.exercise > 300 && withRun.exercise < 450, `exercise ${withRun.exercise}`);
    ok(`${label}: a workout is logged and its calories join the day's budget (${withRun.exercise} kcal)`);

    // ── progress and profile ──
    await page.getByRole('button', { name: 'Progress', exact: true }).click();
    await page.getByLabel('Today’s weight in kilograms').fill('82.5');
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await page.getByPlaceholder(/now 82\.5/).waitFor();
    await shot('09-progress');
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Profile and goals' }).waitFor();
    assert.equal(await page.getByLabel('Weight (kg)').inputValue(), '82.5');
    const before = Number((await page.locator('.eyebrow:has-text("Your daily target") + div').innerText()).match(/\d+/)[0]);
    await page.getByLabel('Goal').selectOption('lose');
    const after = Number((await page.locator('.eyebrow:has-text("Your daily target") + div').innerText()).match(/\d+/)[0]);
    assert.ok(before - after > 500, `a weight-loss goal should cut calories (${before} -> ${after})`);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Saved').waitFor();
    await shot('10-profile');
    await shot('full-10-profile');
    await noSideScroll('the profile');
    ok(`${label}: weigh-ins update the profile, and a weight-loss goal lowers the target (${before} to ${after} kcal)`);

    // ── backup ──
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
    const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(backup.app, 'modaward-trackweight');
    const counts = { entries: backup.entries.length, workouts: backup.workouts.length, weights: backup.weights.length, foods: backup.foods.length };
    assert.deepEqual(counts, { entries: 5, workouts: 1, weights: 1, foods: 5 });
    ok(`${label}: the backup file holds the diary: ${counts.entries} entries, ${counts.workouts} workout, ${counts.weights} weigh-in, ${counts.foods} saved foods`);

    // ── it is all still there after a reload ──
    await page.reload();
    await page.getByText(/kcal (left|over)/).waitFor();
    await page.locator('.tw-entry', { hasText: 'Lentil soup' }).waitFor();
    assert.equal((await diaryNumbers()).exercise, withRun.exercise);
    ok(`${label}: the diary survives a reload (it lives on the device)`);

    // ── offline: the page opens from the service worker's cache with the same diary ──
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => 0));
    await page.reload(); // now controlled by the worker: modules are cached as they load
    await page.getByText(/kcal (left|over)/).waitFor();
    await page.waitForTimeout(400);
    offline.on = true;
    await ctx.setOffline(true);
    await page.reload();
    await page.getByText(/kcal (left|over)/).waitFor({ timeout: 10_000 });
    await page.locator('.tw-entry', { hasText: 'Lentil soup' }).waitFor();
    await page.getByRole('button', { name: 'Add food' }).click();
    await page.getByLabel('Search foods').fill('nutella');
    await page.getByRole('button', { name: /Nutella/ }).first().waitFor(); // from "my foods", no network needed
    await page.getByText(/offline/i).waitFor({ timeout: 5000 });
    await shot('11-offline');
    await page.waitForTimeout(300);
    assert.deepEqual([...new Set(offline.failed)], ['/api/trackweight/foods/search'], 'offline, only the online food search may fail; the page and all its modules come from the cache');
    await ctx.setOffline(false);
    offline.on = false;
    ok(`${label}: offline, the page and the diary still open, and food search says it is offline`);

    // ── the main app is untouched ──
    await ctx.clearCookies(); // the photo step signed this browser in; look at the front page as a visitor
    await page.goto('/');
    await page.getByRole('heading', { name: /Dress for the day/ }).waitFor();
    ok(`${label}: the ModaWard front page still loads normally`);
  } catch (e) {
    fail(`${label}: ${e.stack || e}`);
    if (shots) await page.screenshot({ path: path.join(shots, `tw-${label}-FAILED.png`), fullPage: true }).catch(() => {});
  }
  for (const p of new Set(problems)) fail(`${label}: ${p}`);
  await ctx.close();
}

const only = process.env.ONLY;
if (!only || only === 'phone') await run('phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
if (!only || only === 'desktop') await run('desktop', { viewport: { width: 1280, height: 800 } });

await browser.close();
await t.close();
if (failures.length) {
  console.error(`\n${failures.length} problem(s)`);
  process.exit(1);
}
console.log('\nTrack Weight end-to-end: all checks passed');
