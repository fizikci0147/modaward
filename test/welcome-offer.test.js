import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser } from './helpers.js';

const DAY = 86400;

describe('free Pro for new sign-ups', () => {
  const servers = [];
  after(() => Promise.all(servers.map((s) => s.close())));
  const start = async (days) => {
    const t = await startTestServer({ env: days === undefined ? {} : { SIGNUP_PRO_DAYS: String(days) } });
    servers.push(t);
    return t;
  };

  test('is off unless a number of days is set, and nothing about it shows to visitors', async () => {
    const t = await start();
    const c = t.client();
    assert.equal((await c.get('/api/auth/me')).json.capabilities.promo.proDays, 0);
    const { user } = await registerUser(c);
    assert.equal(user.plan, 'free');
    assert.equal(user.planStatus ?? null, null);
  });

  test('a new account gets Pro for the set number of days, as time-limited granted access', async () => {
    const t = await start(90);
    const c = t.client();
    assert.equal((await c.get('/api/auth/me')).json.capabilities.promo.proDays, 90);
    const before = Math.floor(Date.now() / 1000);
    const { user } = await registerUser(c);
    assert.equal(user.plan, 'pro');
    assert.equal(user.planStatus, 'granted');
    assert.ok(Math.abs(user.planRenewsAt - (before + 90 * DAY)) < 30, 'ends 90 days after joining');
    const me = (await c.get('/api/auth/me')).json;
    assert.equal(me.entitlements.plan, 'pro');
    assert.equal(me.entitlements.closetLimit, null, 'the free closet limit is lifted');
    assert.equal(me.entitlements.planDays, 8);
  });

  test('it ends by itself, back to the free plan, and the account keeps working', async () => {
    const t = await start(90);
    const c = t.client();
    const { user } = await registerUser(c);
    t.deps.repos.users.setPlan(user.id, { plan: 'pro', status: 'granted', renewsAt: Math.floor(Date.now() / 1000) - 5 });
    const me = (await c.get('/api/auth/me')).json;
    assert.equal(me.entitlements.plan, 'free');
    assert.equal(me.entitlements.closetLimit, 30);
  });

  test('is not given to existing accounts, to people signing in, or twice', async () => {
    const t = await start(0);
    const c = t.client();
    const { email, password } = await registerUser(c);
    t.deps.config.plans.signupProDays = 60;
    const again = t.client();
    const login = await again.post('/api/auth/login', { email, password });
    assert.equal(login.json.user.plan, 'free');
    const dup = await t.client().post('/api/auth/register', { email, password, name: 'x', acceptTerms: true });
    assert.equal(dup.status, 409);
  });

  test('an out-of-range setting is kept sensible', async () => {
    const t = await start(-5);
    assert.equal(t.deps.config.plans.signupProDays, 0);
    const big = await start(99999);
    assert.equal(big.deps.config.plans.signupProDays, 365);
  });
});
