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
