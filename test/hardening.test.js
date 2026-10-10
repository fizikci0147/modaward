import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';
import { parsePriceCents } from '../src/shop/feed.js';
import { email } from '../src/util/validate.js';
import { clientKey } from '../src/http/middleware.js';
import { baseUrl } from '../src/http/base-url.js';
import { recommend } from '../src/engine/outfit.js';
import { packTrip } from '../src/engine/trip.js';
import { closet, MILD, COLD_RAIN, HOT_SUN, day } from './fixtures.js';

describe('input parsing', () => {
  test('prices in every common feed format', () => {
    const cases = { '29.99': 2999, '29,99 EUR': 2999, '1,299.00': 129900, '1.299,00': 129900, '$1,299': 129900, 49: 4900, '€ 59,9': 5990, 'USD 19.00': 1900 };
    for (const [input, cents] of Object.entries(cases)) assert.equal(parsePriceCents(input), cents, input);
    for (const bad of ['', 'free', '0', '0.00', null]) assert.equal(parsePriceCents(bad), null, String(bad));
  });

  test('an email address names exactly one mailbox', () => {
    const rule = email();
    assert.equal(rule('Ada@Example.com'), 'ada@example.com');
    for (const bad of ['a@b.com,evil@x.com', 'a@b.com;evil@x.com', '"a b"@x.com', '<a@b.com>', 'a@b.com>', 'a b@c.com', 'a@b', 'a(b)@c.com']) {
      assert.throws(() => rule(bad), /valid email/, bad);
    }
  });

  test('rate limits count a whole IPv6 /64 as one client, and IPv4-mapped addresses as IPv4', () => {
    assert.equal(clientKey('1.2.3.4'), '1.2.3.4');
    assert.equal(clientKey('::ffff:1.2.3.4'), '1.2.3.4');
    assert.equal(clientKey('2001:db8:85a3:8d3:1319:8a2e:370:7348'), clientKey('2001:db8:85a3:8d3:ffff::1'));
    assert.notEqual(clientKey('2001:db8:85a3:8d3::1'), clientKey('2001:db8:85a3:8d4::1'));
  });

  test('the Host header is only trusted for localhost, and only without APP_URL', () => {
    const req = (host) => ({ protocol: 'http', get: () => host });
    assert.equal(baseUrl({ appUrl: 'https://app.example.com' }, req('evil.test')), 'https://app.example.com');
    assert.equal(baseUrl({ appUrl: '', production: true }, req('localhost:3000')), null);
    assert.equal(baseUrl({ appUrl: '', production: false }, req('localhost:3000')), 'http://localhost:3000');
    assert.equal(baseUrl({ appUrl: '', production: false }, req('evil.test')), null);
  });
});

describe('engine safety nets', () => {
  test('without a waterproof layer, a downpour never scores like a good outfit', () => {
    const dry = closet().filter((g) => !g.name.includes('rain jacket') && !g.name.includes('Waterproof') && !g.name.includes('trench') && !g.name.includes('parka'));
    const pour = day({ min: 8, max: 12, rainProb: 95, rainMm: 20, code: 65 });
    const out = recommend({ garments: dry, day: pour, occasion: 'casual', seed: 's', count: 3 });
    assert.ok(out.outfits.length > 0);
    for (const o of out.outfits) assert.ok(o.score < 75, `score ${o.score} for ${o.itemIds}`);
    assert.ok(out.outfits[0].warnings.length > 0, 'and it says so');
  });

  test('every suggestion is close to the best one, however much variety is asked for', () => {
    const out = recommend({ garments: closet(), day: COLD_RAIN, occasion: 'casual', seed: 's', count: 5 });
    const best = out.outfits[0].score;
    for (const o of out.outfits) assert.ok(best - o.score <= 25, `${o.score} vs best ${best}`);
  });

  test('a packing list keeps shoes and outer layers to two each when the closet allows', () => {
    const days = [MILD, COLD_RAIN, HOT_SUN, day({ date: '2026-10-08', min: 10, max: 16, rainProb: 40, rainMm: 2, code: 61 }), day({ date: '2026-10-09', min: 5, max: 10, code: 3 }), day({ date: '2026-10-10', min: 18, max: 26, code: 0 })].map((d, i) => ({ ...d, date: `2026-10-${String(7 + i).padStart(2, '0')}` }));
    const pack = packTrip({ garments: closet(), days, occasions: ['casual'], prefs: undefined, history: undefined, units: 'metric', seed: 's' });
    const count = (cat) => pack.pack.filter((p) => p.item.category === cat).length;
    assert.ok(count('shoes') <= 2, `shoes ${count('shoes')}`);
    assert.ok(count('outerwear') <= 2, `outerwear ${count('outerwear')}`);
  });

  test('a very large closet is styled quickly', () => {
    const base = closet();
    const big = [];
    for (let i = 0; i < 12; i++) for (const g of base) big.push({ ...g, id: `${g.id}-${i}`, name: `${g.name} ${i}` });
    const t0 = Date.now();
    const out = recommend({ garments: big, day: MILD, occasion: 'casual', seed: 's', count: 3 });
    assert.ok(out.outfits.length === 3);
    assert.ok(Date.now() - t0 < 4000, `took ${Date.now() - t0}ms for ${big.length} pieces`);
  });
});

describe('wear logging, trips, shop and reminders through the API', () => {
  let t;
  let mailFails = false;
  const mails = [];
  before(async () => {
    t = await startTestServer({
      env: { APP_URL: 'https://app.example.com' },
      overrides: { mailer: { configured: true, send: async (m) => { if (mailFails) throw new Error('smtp down'); mails.push(m); return { delivered: true }; } } }
    });
  });
  after(() => t.close());
  beforeEach(() => {
    mails.length = 0;
    mailFails = false;
  });

  async function person() {
    const c = t.client();
    const reg = await registerUser(c);
    await c.patch('/api/profile', { location: NYC, department: 'men' });
    await c.post('/api/garments/starter', { department: 'men' });
    return { c, id: reg.user.id };
  }
  const recommendOne = async (c) => (await c.post('/api/outfits/recommend', { occasion: 'casual', count: 3 })).json.outfits;

  test('wearing is date-checked, replaces an earlier outfit for the day, and learns only once', async () => {
    const { c, id } = await person();
    const [a, b] = await recommendOne(c);
    const date = new Date().toISOString().slice(0, 10);
    assert.equal((await c.post('/api/outfits/wear', { date: '1990-01-01', itemIds: a.itemIds })).status, 400);
    assert.equal((await c.post('/api/outfits/wear', { date: '2999-01-01', itemIds: a.itemIds })).status, 400);
    assert.equal((await c.del('/api/outfits/wear?date=1990-01-01')).status, 400);

    await c.post('/api/outfits/wear', { date, itemIds: a.itemIds, key: a.key });
    const learned = t.deps.repos.profiles.getTaste(id).n;
    await c.post('/api/outfits/wear', { date, itemIds: a.itemIds, key: a.key });
    assert.equal(t.deps.repos.profiles.getTaste(id).n, learned, 'a double tap teaches nothing new');

    await c.post('/api/outfits/wear', { date, itemIds: b.itemIds, key: b.key });
    const rows = t.deps.db.all('SELECT garment_id FROM wear_log WHERE user_id = ? AND worn_on = ?', id, date).map((r) => r.garment_id).sort();
    assert.deepEqual(rows, [...b.itemIds].sort(), 'changing your mind replaces the outfit rather than adding to it');
  });

  test('undoing the outfit leaves pieces logged one by one from the closet', async () => {
    const { c, id } = await person();
    const [a] = await recommendOne(c);
    const date = new Date().toISOString().slice(0, 10);
    const lone = (await c.get('/api/garments')).json.garments.find((g) => !a.itemIds.includes(g.id));
    await c.post(`/api/garments/${lone.id}/worn`, { date });
    await c.post('/api/outfits/wear', { date, itemIds: a.itemIds, key: a.key });
    assert.equal((await c.del(`/api/outfits/wear?date=${date}`)).json.removed, a.itemIds.length);
    const left = t.deps.db.all('SELECT garment_id FROM wear_log WHERE user_id = ? AND worn_on = ?', id, date);
    assert.deepEqual(left.map((r) => r.garment_id), [lone.id]);
  });

  test('a free account can plan a short trip starting later, but not a long one', async () => {
    const { c } = await person();
    assert.equal((await c.post('/api/trips/plan', { days: 3, startOffset: 4, occasions: ['casual'] })).status, 200);
    assert.equal((await c.post('/api/trips/plan', { days: 6, startOffset: 0, occasions: ['casual'] })).status, 402);
  });

  test('looks use a small set of variations, so a made-up seed cannot force endless rebuilds', async () => {
    const { c } = await person();
    const first = await c.post('/api/shop/looks', { seed: 'x'.repeat(40), limit: 6, curate: false });
    assert.equal(first.status, 200);
    t.deps.shop.stats.computed = 0;
    for (const seed of ['1', '25', '49']) assert.equal((await c.post('/api/shop/looks', { seed, limit: 6, curate: false })).status, 200);
    assert.equal(t.deps.shop.stats.computed, 1, 'seeds 1, 25 and 49 are the same variation');
  });

  test('"never suggest this piece" is lasting, reversible, and keeps the piece in the closet', async () => {
    const { c } = await person();
    const first = (await recommendOne(c))[0];
    const victim = first.itemIds[0];
    assert.equal((await c.patch(`/api/garments/${victim}`, { excluded: true })).status, 200);
    for (let i = 0; i < 4; i++) {
      for (const o of (await c.post('/api/outfits/recommend', { occasion: 'casual', count: 3, seed: `s${i}` })).json.outfits) assert.ok(!o.itemIds.includes(victim), 'excluded piece came back');
    }
    const week = (await c.post('/api/plan', {})).json.days.flatMap((d) => d.outfits || []).flatMap((o) => o.itemIds);
    assert.ok(!week.includes(victim), 'excluded piece in the week plan');
    const closet = (await c.get('/api/garments')).json.garments;
    assert.equal(closet.find((g) => g.id === victim)?.excluded, true, 'still in the closet, marked');
    // asking to style that very piece still works: the person chose it
    assert.ok((await c.post('/api/outfits/recommend', { occasion: 'casual', featureId: victim })).json.outfits.every((o) => o.itemIds.includes(victim)));
    assert.equal((await c.patch(`/api/garments/${victim}`, { excluded: false })).status, 200);
    let back = false;
    for (let i = 0; i < 12 && !back; i++) back = (await c.post('/api/outfits/recommend', { occasion: 'casual', count: 5, seed: `r${i}` })).json.outfits.some((o) => o.itemIds.includes(victim));
    assert.ok(back, 'undo should bring it back into rotation');
  });

  test('a shop feed is built in a few seconds, not tens (layering must not multiply the search)', async () => {
    const { c } = await person();
    const started = Date.now();
    const r = await c.post('/api/shop/looks', { seed: 'speed', limit: 24, curate: false });
    assert.equal(r.status, 200);
    assert.ok(Date.now() - started < 6000, `took ${Date.now() - started}ms`);
  });

  test('the app keeps reminders on the device’s time zone, for people who already have reminders', async () => {
    const { c } = await person();
    assert.equal((await c.put('/api/reminders/timezone', { tz: 'Asia/Tokyo' })).status, 200);
    assert.equal((await c.get('/api/reminders')).json.prefs.tz, 'UTC', 'no preferences yet, so nothing is created');
    await c.put('/api/reminders', { daily: { on: true, hour: 7 }, tz: 'America/New_York' });
    await c.put('/api/reminders/timezone', { tz: 'Europe/Istanbul' });
    assert.equal((await c.get('/api/reminders')).json.prefs.tz, 'Europe/Istanbul');
    assert.equal((await c.put('/api/reminders/timezone', { tz: 'Mars/Olympus' })).status, 400);
  });

  test('a reminder that could not be delivered is tried again, then sent once', async () => {
    const { c, id } = await person();
    await c.put('/api/reminders', { daily: { on: true, hour: 7 }, push: false, email: true, tz: 'America/New_York' });
    t.deps.db.run('DELETE FROM reminder_log');
    const at = new Date('2026-10-06T11:05:00Z'); // 7:05 in New York
    mailFails = true;
    assert.equal((await t.deps.reminders.tick(at)).sent, 0);
    assert.equal(t.deps.db.get('SELECT COUNT(*) AS n FROM reminder_log WHERE user_id = ?', id).n, 0, 'the claim was released');
    mailFails = false;
    assert.equal((await t.deps.reminders.tick(new Date(at.getTime() + 5 * 60_000))).sent, 1);
    assert.equal(mails.length, 1);
    await t.deps.reminders.tick(new Date(at.getTime() + 10 * 60_000));
    assert.equal(mails.length, 1, 'and only once');
    assert.equal(t.deps.db.get("SELECT delivered FROM reminder_log WHERE user_id = ? AND kind = 'daily'", id).delivered, 1);
  });
});

describe('operations scripts and database start-up', () => {
  test('the backup script refuses to back up nothing, and keeps the generated secrets with a real backup', async () => {
    const { execFileSync, spawnSync } = await import('node:child_process');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { openDb } = await import('../src/db/index.js');
    const root = path.resolve(import.meta.dirname, '..');
    const run = (dataDir, ...args) => spawnSync(process.execPath, [path.join(root, 'scripts/backup.mjs'), ...args], { env: { ...process.env, DATA_DIR: dataDir, NODE_ENV: 'test' }, encoding: 'utf8' });

    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-bk-'));
    const refused = run(empty);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /no database/);
    assert.equal(fs.existsSync(path.join(empty, 'modaward.db')), false, 'and it did not create one');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-bk-'));
    const db = await openDb(path.join(dir, 'modaward.db'));
    db.close();
    assert.equal(run(dir).status, 1, 'a database with no users is the wrong database');

    const db2 = await openDb(path.join(dir, 'modaward.db'));
    db2.run("INSERT INTO users (id,email,password_hash,created_at) VALUES ('u1','a@b.co','x',1)");
    db2.close();
    fs.mkdirSync(path.join(dir, 'secrets'));
    fs.writeFileSync(path.join(dir, 'secrets', 'vapid.json'), '{"k":1}');
    const ok = run(dir);
    assert.equal(ok.status, 0, ok.stderr);
    const stamp = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, 'backups', `modaward-${stamp}.db`);
    assert.equal((fs.statSync(file).mode & 0o777).toString(8), '600');
    assert.ok(fs.existsSync(path.join(dir, 'backups', `secrets-${stamp}`, 'vapid.json')));
    assert.equal(fs.readdirSync(path.join(dir, 'backups')).some((f) => f.endsWith('.partial')), false);
    execFileSync(process.execPath, ['-e', '0']);
  });

  test('two processes starting together do not collide on the same migration', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { openDb } = await import('../src/db/index.js');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mw-mig-')), 'm.db');
    const [a, b] = await Promise.all([openDb(file), openDb(file)]);
    assert.equal(a.get('SELECT COUNT(*) AS n FROM schema_migrations').n, b.get('SELECT COUNT(*) AS n FROM schema_migrations').n);
    a.close();
    b.close();
  });
});
