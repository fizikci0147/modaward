import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';
import { loadConfig } from '../src/config.js';

describe('the free version (PRICING=free, the default)', () => {
  const servers = [];
  after(() => Promise.all(servers.map((s) => s.close())));
  const start = async (env = {}) => {
    const t = await startTestServer({ env: { PRICING: 'free', ...env } });
    servers.push(t);
    return t;
  };

  test('free is the default when nothing is set, and a welcome offer cannot be switched on by accident', () => {
    const base = { DATA_DIR: '/tmp/mw-x', NODE_ENV: 'test' };
    assert.equal(loadConfig({ ...base }, { dotenv: false }).plans.pricing, 'free');
    assert.equal(loadConfig({ ...base, SIGNUP_PRO_DAYS: '90' }, { dotenv: false }).plans.signupProDays, 0);
    assert.equal(loadConfig({ ...base, PRICING: 'paid', SIGNUP_PRO_DAYS: '90' }, { dotenv: false }).plans.signupProDays, 90);
    assert.equal(loadConfig({ ...base, PRICING: 'nonsense' }, { dotenv: false }).plans.pricing, 'free');
  });

  test('everyone gets everything: no closet limit, the whole week, every shop look, unlimited saves', async () => {
    const t = await start();
    const c = t.client();
    const { user } = await registerUser(c);
    assert.equal(user.plan, 'free');
    const me = (await c.get('/api/auth/me')).json;
    assert.deepEqual(me.entitlements, { plan: 'free', pricing: 'free', closetLimit: null, planDays: 8, shopLooks: 36, aiStylist: false, photoTagging: false, savedLooks: null });
    assert.equal(me.capabilities.pricing, 'free');
    assert.equal(me.capabilities.billing, false);
    assert.equal(me.capabilities.promo.proDays, 0);

    await c.patch('/api/profile', { location: NYC, department: 'women' });
    const week = (await c.post('/api/plan', {})).json;
    assert.equal(week.days.length, 8);
    assert.equal(week.days.filter((d) => d.locked).length, 0, 'no day is locked');
  });

  test('a closet can grow past the old free limit of 30 pieces', async () => {
    const t = await start();
    const c = t.client();
    await registerUser(c);
    assert.equal((await c.post('/api/garments/starter', { department: 'women' })).status, 201);
    for (let i = 0; i < 40; i++) {
      const r = await c.post('/api/garments', { type: 'tee', color: '#aa3344', name: `Tee ${i}` });
      assert.equal(r.status, 201, `piece ${i}: ${r.text.slice(0, 120)}`);
    }
    assert.ok((await c.get('/api/garments')).json.garments.length > 50);
  });

  test('nothing is for sale: no checkout, no billing portal, even with Stripe keys present', async () => {
    const t = await start({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_MONTHLY: 'price_1', STRIPE_PRICE_YEARLY: 'price_2', STRIPE_WEBHOOK_SECRET: 'whsec_x' });
    const c = t.client();
    await registerUser(c);
    assert.equal((await c.post('/api/billing/checkout', { interval: 'month' })).status, 503);
    assert.equal((await c.post('/api/billing/portal', {})).status, 503);
    assert.equal((await c.get('/api/auth/me')).json.capabilities.billing, false);
  });

  test('AI features stay off unless the operator turns them on for everyone (FREE_AI)', async () => {
    const off = await start();
    const c1 = off.client();
    await registerUser(c1);
    assert.equal((await c1.get('/api/auth/me')).json.entitlements.aiStylist, false);
    const on = await start({ FREE_AI: '1' });
    const c2 = on.client();
    await registerUser(c2);
    const ent = (await c2.get('/api/auth/me')).json.entitlements;
    assert.equal(ent.aiStylist, true);
    assert.equal(ent.photoTagging, true);
  });

  test('the paid plans still work exactly as before when PRICING=paid', async () => {
    const t = await startTestServer({ env: { PRICING: 'paid' } });
    servers.push(t);
    const c = t.client();
    await registerUser(c);
    const ent = (await c.get('/api/auth/me')).json.entitlements;
    assert.equal(ent.pricing, 'paid');
    assert.equal(ent.closetLimit, 30);
    assert.equal(ent.planDays, 3);
  });
});
