import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser } from './helpers.js';

describe('admin access and Pro codes', () => {
  let t;
  let admin;
  let alice;
  before(async () => {
    t = await startTestServer({ env: { ADMIN_EMAILS: 'boss@example.com' } });
    admin = t.client();
    await registerUser(admin, { email: 'boss@example.com' });
    alice = t.client();
    await registerUser(alice, { email: 'alice@example.com' });
  });
  after(() => t.close());

  test('only listed admins reach the admin API', async () => {
    assert.equal((await admin.get('/api/admin/codes')).status, 200);
    assert.equal((await alice.get('/api/admin/codes')).status, 403);
    assert.equal((await alice.post('/api/admin/codes', { days: 30 })).status, 403);
    assert.equal((await alice.post('/api/admin/grants', { email: 'alice@example.com', days: 30 })).status, 403);
    assert.equal((await admin.get('/api/auth/me')).json.user.isAdmin, true);
  });

  test('a code gives time-limited Pro once per person and up to its use limit', async () => {
    const made = await admin.post('/api/admin/codes', { days: 30, maxUses: 1, note: 'for Alice' });
    assert.equal(made.status, 201);
    assert.match(made.json.display, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal((await alice.get('/api/auth/me')).json.entitlements.plan, 'free');

    const bob = t.client();
    await registerUser(bob, { email: 'bob@example.com' });
    const lower = made.json.display.toLowerCase().replace(/-/g, ' '); // forgiving input
    const ok = await alice.post('/api/billing/redeem', { code: lower });
    assert.equal(ok.status, 200, ok.text);
    assert.ok(Math.abs(ok.json.until - (Date.now() / 1000 + 30 * 86400)) < 60);
    const me = (await alice.get('/api/auth/me')).json;
    assert.equal(me.entitlements.plan, 'pro');
    assert.equal(me.user.planStatus, 'granted');

    assert.equal((await alice.post('/api/billing/redeem', { code: made.json.code })).status, 400); // already used
    assert.equal((await bob.post('/api/billing/redeem', { code: made.json.code })).status, 400); // single-use, used up
    assert.equal((await bob.post('/api/billing/redeem', { code: 'NOPE-NOPE' })).status, 400);
    assert.equal((await bob.get('/api/auth/me')).json.entitlements.plan, 'free');
  });

  test('custom codes, duplicates and deletion', async () => {
    assert.equal((await admin.post('/api/admin/codes', { code: 'welcome30', days: 30, maxUses: 5 })).status, 201);
    assert.equal((await admin.post('/api/admin/codes', { code: 'WELCOME-30', days: 30 })).status, 409);
    const list = (await admin.get('/api/admin/codes')).json.codes;
    assert.ok(list.some((c) => c.code === 'WELCOME30'));
    assert.equal((await admin.del('/api/admin/codes/WELCOME30')).status, 200);
    assert.equal((await admin.del('/api/admin/codes/WELCOME30')).status, 404);
  });

  test('granting by email, and comped time that runs out becomes Free again', async () => {
    const carol = t.client();
    await registerUser(carol, { email: 'carol@example.com' });
    assert.equal((await admin.post('/api/admin/grants', { email: 'nobody@example.com', days: 10 })).status, 404);
    assert.equal((await admin.post('/api/admin/grants', { email: 'Carol@Example.com', days: 10 })).status, 200);
    assert.equal((await carol.get('/api/auth/me')).json.entitlements.plan, 'pro');
    // time passes
    t.deps.db.run("UPDATE users SET plan_renews_at = ? WHERE email = 'carol@example.com'", Math.floor(Date.now() / 1000) - 5);
    const after = (await carol.get('/api/auth/me')).json;
    assert.equal(after.entitlements.plan, 'free');
    assert.equal(after.user.planStatus, null);
  });

  test('a paying subscriber is not overridden by a code, and the sweep expires stale grants', async () => {
    const dan = t.client();
    await registerUser(dan, { email: 'dan@example.com' });
    const row = t.deps.repos.users.byEmail('dan@example.com');
    t.deps.repos.users.setPlan(row.id, { plan: 'pro', status: 'active', renewsAt: Math.floor(Date.now() / 1000) + 86400 });
    const code = (await admin.post('/api/admin/codes', { days: 30 })).json.code;
    assert.equal((await dan.post('/api/billing/redeem', { code })).status, 409);
    t.deps.repos.users.setPlan(row.id, { plan: 'pro', status: 'granted', renewsAt: Math.floor(Date.now() / 1000) - 1 });
    assert.equal(t.deps.codes.sweep(), 1);
    assert.equal(t.deps.repos.users.byId(row.id).plan, 'free');
  });
});

describe('admin business insight', () => {
  let t;
  let admin;
  before(async () => {
    t = await startTestServer({ env: { ADMIN_EMAILS: 'boss@example.com' } });
    admin = t.client();
    await registerUser(admin, { email: 'boss@example.com' });
    const a = t.client();
    await registerUser(a, { email: 'ann_100%@example.com', name: 'Ann' });
    await registerUser(t.client(), { email: 'ben@example.com', name: 'Ben' });
  });
  after(() => t.close());

  test('metrics include funnel, audience, plans and retention', async () => {
    const m = (await admin.get('/api/admin/metrics')).json;
    assert.equal(m.funnel[0].count, 3);
    assert.equal(m.funnel[0].percent, 100);
    assert.ok(m.funnel.length >= 8);
    assert.deepEqual(Object.keys(m.plans).sort(), ['comped', 'free', 'paid']);
    assert.equal(m.plans.free, 3);
    assert.ok(Array.isArray(m.audience.cities) && Array.isArray(m.audience.styles));
    assert.equal(typeof m.retention.week1, 'number');
  });

  test('user list searches, filters, escapes wildcards and is admin-only', async () => {
    const all = (await admin.get('/api/admin/users')).json;
    assert.equal(all.total, 3);
    assert.ok(all.users.every((u) => u.email && 'pieces' in u && 'last_seen_at' in u));
    assert.equal((await admin.get('/api/admin/users?q=ben')).json.users.length, 1);
    assert.equal((await admin.get('/api/admin/users?q=100%25')).json.users.length, 1, 'a literal % matches only that user');
    assert.equal((await admin.get('/api/admin/users?q=%25')).json.users.length, 1, 'a bare % is not a wildcard');
    assert.equal((await admin.get('/api/admin/users?plan=pro')).json.total, 0);
    const outsider = t.client();
    await registerUser(outsider, { email: 'x@example.com' });
    assert.equal((await outsider.get('/api/admin/users')).status, 403);
  });
});

describe('admin activity statistics', () => {
  let t;
  let admin;
  before(async () => {
    t = await startTestServer({ env: { ADMIN_EMAILS: 'boss@example.com' } });
    admin = t.client();
    await registerUser(admin, { email: 'boss@example.com' });
  });
  after(() => t.close());

  test('use is recorded once per person per hour and summarised by hour, weekday and day', async () => {
    await admin.get('/api/auth/me');
    await admin.get('/api/auth/me');
    await admin.get('/api/garments');
    assert.equal(t.deps.db.get('SELECT COUNT(*) AS n FROM user_activity').n, 1, 'one row per person per hour');
    const a = (await admin.get('/api/admin/activity?tz=-300')).json;
    assert.equal(a.heat.length, 7);
    assert.equal(a.heat[0].length, 24);
    assert.equal(a.byHour.reduce((s, n) => s + n, 0), 1);
    assert.equal(a.byWeekday.reduce((s, n) => s + n, 0), 1);
    assert.equal(a.mau, 1);
    assert.equal(a.daily.at(-1).users, 1);
    // the busiest hour matches the viewer's own clock
    const localHour = new Date(Date.now() - 300 * 60_000).getUTCHours();
    assert.equal(a.byHour[localHour], 1);
    const localDay = new Date(Date.now() - 300 * 60_000).getUTCDay();
    assert.equal(a.byWeekday[localDay], 1);
    assert.equal((await t.client().get('/api/admin/activity')).status, 401);
  });

  test('signing out and deleting data keeps the table consistent', async () => {
    assert.equal(t.deps.repos.users.purgeActivity(400), 0);
    t.deps.db.run('UPDATE user_activity SET hour = hour - 24 * 500');
    assert.equal(t.deps.repos.users.purgeActivity(400), 1);
  });
});

describe('admin system check', () => {
  let t;
  let admin;
  before(async () => {
    t = await startTestServer({ env: { ADMIN_EMAILS: 'boss@example.com' } });
    admin = t.client();
    await registerUser(admin, { email: 'boss@example.com' });
  });
  after(() => t.close());
  test('reports weather and integrations to admins only', async () => {
    const s = (await admin.get('/api/admin/system')).json;
    assert.equal(s.weather.probe.ok, true);
    assert.equal(s.integrations.stripe, false);
    assert.ok(s.node.startsWith('v'));
    const other = t.client();
    await registerUser(other, { email: 'z@example.com' });
    assert.equal((await other.get('/api/admin/system')).status, 403);
  });
});
