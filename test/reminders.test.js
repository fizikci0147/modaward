import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';
import { isPushEndpoint } from '../src/services/push.js';
import { localParts, isTimeZone } from '../src/services/reminders.js';

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abcdefghijklmnopqrstuvwxyz', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } };

describe('reminders', () => {
  let t;
  const pushes = [];
  const emails = [];
  let pushFail = null;
  before(async () => {
    t = await startTestServer({
      env: { APP_URL: 'https://app.example.com' },
      overrides: {
        mailer: { configured: true, send: async (m) => (emails.push(m), { delivered: true }) },
        pushSender: async (sub, body) => {
          if (pushFail) throw Object.assign(new Error('gone'), { statusCode: pushFail });
          pushes.push({ sub, payload: JSON.parse(body) });
        }
      }
    });
  });
  after(() => t.close());
  beforeEach(() => {
    pushes.length = 0;
    emails.length = 0;
    pushFail = null;
    t.deps.db.run('DELETE FROM reminder_log');
  });

  async function person({ closet = true, dormantDays = 0 } = {}) {
    const c = t.client();
    const reg = await registerUser(c, { name: 'Ada Lovelace' });
    await c.patch('/api/profile', { location: NYC, department: 'men' });
    if (closet) await c.post('/api/garments/starter', { department: 'men' });
    if (dormantDays) {
      const old = new Date(Date.now() - dormantDays * 86400000).toISOString().slice(0, 10);
      for (const g of (await c.get('/api/garments')).json.garments) t.deps.repos.wear.log(reg.user.id, { garmentIds: [g.id], date: old, outfitKey: `k${g.id}` });
    }
    return { c, id: reg.user.id, email: reg.email };
  }
  const NY = (iso) => new Date(iso); // 2026-10-06 is a Tuesday; New York is UTC−4 in October

  test('only real browser push services are accepted as endpoints (no server-side request forgery)', () => {
    for (const ok of ['https://fcm.googleapis.com/fcm/send/x'.padEnd(40, 'x'), 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/QAbc', 'https://wns2-par02p.notify.windows.com/w/?token=abc']) {
      assert.equal(isPushEndpoint(ok), true, ok);
    }
    for (const bad of ['http://fcm.googleapis.com/fcm/send/x', 'https://169.254.169.254/latest/meta-data', 'https://localhost/x', 'https://storage.googleapis.com/x', 'https://evil.example.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'not a url']) {
      assert.equal(isPushEndpoint(bad), false, bad);
    }
  });

  test('local time in a time zone', () => {
    assert.deepEqual(localParts(NY('2026-10-06T11:05:00Z'), 'America/New_York'), { date: '2026-10-06', hour: 7, weekday: 2 });
    assert.deepEqual(localParts(NY('2026-10-06T23:30:00Z'), 'Asia/Tokyo'), { date: '2026-10-07', hour: 8, weekday: 3 });
    assert.equal(localParts(NY('2026-10-06T11:05:00Z'), 'Not/AZone').hour, 11); // falls back to UTC
    assert.equal(isTimeZone('Europe/Istanbul'), true);
    assert.equal(isTimeZone('nope'), false);
  });

  test('preferences: defaults, save, validation, privacy', async () => {
    const { c } = await person();
    const first = (await c.get('/api/reminders')).json;
    assert.equal(first.prefs.daily.on, false);
    assert.equal(first.prefs.email, false, 'email is opt-in');
    assert.equal(first.push.available, true);
    assert.match(first.push.publicKey, /^[A-Za-z0-9_-]{80,}$/);
    assert.equal(first.emailAvailable, true);
    const saved = (await c.put('/api/reminders', { daily: { on: true, hour: 6 }, weekly: { on: true }, tz: 'America/New_York' })).json;
    assert.deepEqual(saved.prefs.daily, { on: true, hour: 6 });
    assert.equal(saved.prefs.tz, 'America/New_York');
    assert.equal((await c.put('/api/reminders', { daily: { hour: 24 } })).status, 400);
    assert.equal((await c.put('/api/reminders', { tz: 'Mars/Olympus' })).status, 400);
    assert.equal((await t.client().get('/api/reminders')).status, 401);
  });

  test('push subscription: validated, stored per device, removable', async () => {
    const { c } = await person();
    assert.equal((await c.post('/api/reminders/push/subscribe', { endpoint: 'http://169.254.169.254/x'.padEnd(30, 'x'), keys: SUB.keys })).status, 400);
    const r = await c.post('/api/reminders/push/subscribe', SUB);
    assert.equal(r.status, 200);
    assert.equal(r.json.push.devices, 1);
    assert.equal((await c.post('/api/reminders/push/subscribe', SUB)).json.push.devices, 1, 'same device is not duplicated');
    assert.equal((await c.post('/api/reminders/push/unsubscribe', { endpoint: SUB.endpoint })).json.push.devices, 0);
  });

  test('morning outfit goes out once, at the person’s local time', async () => {
    const { c, id } = await person();
    await c.post('/api/reminders/push/subscribe', SUB);
    await c.put('/api/reminders', { daily: { on: true, hour: 7 }, tz: 'America/New_York' });
    t.deps.db.run('DELETE FROM reminder_log'); // the save above skips "today" if its time had passed

    assert.equal((await t.deps.reminders.tick(NY('2026-10-06T10:30:00Z'))).sent, 0, '6:30 in New York is too early');
    assert.equal(pushes.length, 0);
    const r = await t.deps.reminders.tick(NY('2026-10-06T11:05:00Z'));
    assert.equal(r.sent, 1);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].sub.endpoint, SUB.endpoint);
    assert.match(pushes[0].payload.title, /^Today: \d+° to \d+° · /);
    assert.ok(pushes[0].payload.body.length > 10);
    assert.equal(pushes[0].payload.url, '/');
    await t.deps.reminders.tick(NY('2026-10-06T11:10:00Z'));
    assert.equal(pushes.length, 1, 'not sent twice');
    await t.deps.reminders.tick(NY('2026-10-06T21:00:00Z'));
    assert.equal(pushes.length, 1, 'a morning outfit is not sent in the evening after a restart');
    await t.deps.reminders.tick(NY('2026-10-07T11:05:00Z'));
    assert.equal(pushes.length, 2, 'and again the next morning');
    assert.ok(id);
  });

  test('turning a reminder on after its time has passed waits for tomorrow', async () => {
    const { c } = await person();
    await c.post('/api/reminders/push/subscribe', SUB);
    const now = new Date();
    const hour = localParts(now, 'UTC').hour;
    await c.put('/api/reminders', { daily: { on: true, hour: Math.max(0, hour - 1) }, tz: 'UTC' });
    await t.deps.reminders.tick(now);
    if (hour >= 1) assert.equal(pushes.length, 0, 'no surprise message the moment it is switched on');
  });

  test('the week-ahead reminder goes out Sunday evening', async () => {
    const { c } = await person();
    await c.post('/api/reminders/push/subscribe', SUB);
    await c.put('/api/reminders', { weekly: { on: true }, tz: 'America/New_York' });
    t.deps.db.run('DELETE FROM reminder_log');
    await t.deps.reminders.tick(NY('2026-10-10T22:00:00Z')); // Saturday evening
    assert.equal(pushes.length, 0);
    await t.deps.reminders.tick(NY('2026-10-11T22:00:00Z')); // Sunday 18:00
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].payload.title, 'Your week ahead');
    assert.equal(pushes[0].payload.url, '/week');
  });

  test('the forgotten-pieces nudge names the pieces, and stays quiet when nothing is forgotten', async () => {
    const forgetful = await person({ dormantDays: 100 });
    const busy = await person({ dormantDays: 2 });
    for (const p of [forgetful, busy]) {
      await p.c.post('/api/reminders/push/subscribe', { ...SUB, endpoint: `${SUB.endpoint}${p.id.slice(0, 6)}` });
      await p.c.put('/api/reminders', { idle: { on: true }, tz: 'America/New_York' });
    }
    t.deps.db.run('DELETE FROM reminder_log');
    await t.deps.reminders.tick(NY('2026-10-10T14:00:00Z')); // Saturday 10:00
    assert.equal(pushes.length, 1);
    assert.match(pushes[0].payload.title, /pieces have not been worn in a while/);
    assert.equal(pushes[0].payload.url, '/closet');
    assert.ok(pushes[0].sub.endpoint.endsWith(forgetful.id.slice(0, 6)));
    // not again for two weeks
    t.deps.db.run("UPDATE reminder_log SET day = '2026-10-10' WHERE kind = 'idle'");
    await t.deps.reminders.tick(NY('2026-10-17T14:00:00Z'));
    assert.equal(pushes.length, 1, 'a week later is too soon');
  });

  test('email reminders are opt-in, carry an unsubscribe link, and the link works', async () => {
    const { c, id, email } = await person();
    await c.put('/api/reminders', { daily: { on: true, hour: 7 }, push: false, email: true, tz: 'America/New_York' });
    t.deps.db.run('DELETE FROM reminder_log');
    await t.deps.reminders.tick(NY('2026-10-06T11:05:00Z'));
    assert.equal(emails.length, 1);
    const m = emails[0];
    assert.equal(m.to, email);
    assert.match(m.subject, /^Today:/);
    assert.match(m.text, /https:\/\/app\.example\.com\/unsubscribe\?u=/);
    assert.match(m.headers['List-Unsubscribe'], /^<https:\/\/app\.example\.com\/unsubscribe\?u=/);
    assert.doesNotMatch(m.html, /<script/i);

    const url = new URL(m.text.match(/https:\/\/app\.example\.com\/unsubscribe\?[^\s]+/)[0]);
    const anon = t.client();
    assert.equal((await anon.post('/api/reminders/unsubscribe', { u: id, t: 'x'.repeat(43) })).status, 400, 'bad token');
    assert.equal((await anon.post('/api/reminders/unsubscribe', { u: url.searchParams.get('u'), t: url.searchParams.get('t') })).status, 200);
    assert.equal((await c.get('/api/reminders')).json.prefs.email, false);
  });

  test('dead devices are removed, and one failing device does not stop the others', async () => {
    const { c, id } = await person();
    await c.post('/api/reminders/push/subscribe', SUB);
    pushFail = 410;
    assert.equal(await t.deps.push.notify(id, { title: 'x', body: 'y' }), 0);
    assert.equal(t.deps.push.count(id), 0, 'a gone subscription is deleted');
    await c.post('/api/reminders/push/subscribe', SUB);
    pushFail = 500;
    await t.deps.push.notify(id, { title: 'x', body: 'y' });
    assert.equal(t.deps.push.count(id), 1, 'a temporary failure keeps it');
  });

  test('"send me a test" delivers today’s message now, and explains when there is nothing to send', async () => {
    const { c } = await person();
    await c.post('/api/reminders/push/subscribe', SUB);
    const r = await c.post('/api/reminders/test', { kind: 'daily' });
    assert.equal(r.status, 200);
    assert.equal(r.json.skipped, false);
    assert.equal(r.json.delivered.push, 1);
    assert.match(r.json.message.title, /^Today:/);
    assert.equal(pushes.length, 1);
    const none = (await c.post('/api/reminders/test', { kind: 'idle' })).json;
    assert.equal(none.skipped, true);
    assert.equal((await c.post('/api/reminders/test', { kind: 'bogus' })).status, 400);
  });

  test('messages follow the person’s language', async () => {
    const { c } = await person();
    await c.patch('/api/profile', { locale: 'es' });
    await c.post('/api/reminders/push/subscribe', SUB);
    const r = (await c.post('/api/reminders/test', { kind: 'weekly' })).json;
    assert.doesNotMatch(r.message.title, /^Your week ahead$/);
  });
});
