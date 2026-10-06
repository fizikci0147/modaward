import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startTestServer, registerUser } from './helpers.js';
import { verifySignature } from '../src/services/billing.js';

const SECRET = 'whsec_test_secret_value';
const sign = (body, { t = Math.floor(Date.now() / 1000), secret = SECRET } = {}) =>
  `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

describe('stripe signature verification', () => {
  const body = '{"id":"evt_1"}';
  test('accepts a valid signature, rejects tampering, wrong secret, stale and malformed headers', () => {
    assert.equal(verifySignature(Buffer.from(body), sign(body), SECRET), true);
    assert.equal(verifySignature(Buffer.from(body + ' '), sign(body), SECRET), false);
    assert.equal(verifySignature(Buffer.from(body), sign(body, { secret: 'other' }), SECRET), false);
    assert.equal(verifySignature(Buffer.from(body), sign(body, { t: Math.floor(Date.now() / 1000) - 3600 }), SECRET), false); // replay
    for (const bad of ['', 'garbage', 't=abc,v1=00', 't=1', 'v1=00']) assert.equal(verifySignature(Buffer.from(body), bad, SECRET), false, bad);
    assert.equal(verifySignature(Buffer.from(body), sign(body), ''), false);
  });
  test('accepts when any of several v1 signatures matches (secret rotation)', () => {
    const t = Math.floor(Date.now() / 1000);
    const good = crypto.createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
    assert.equal(verifySignature(Buffer.from(body), `t=${t},v1=${'0'.repeat(64)},v1=${good}`, SECRET), true);
  });
});

describe('billing', () => {
  let t;
  let calls = [];
  let stripeReply = () => ({ ok: true, status: 200, json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }) });
  before(async () => {
    const fakeFetch = async (url, init) => {
      calls.push({ url, init });
      return stripeReply(url, init);
    };
    t = await startTestServer({
      env: { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_MONTHLY: 'price_month', STRIPE_PRICE_YEARLY: 'price_year', APP_URL: 'https://app.example.com' },
      overrides: { fetch: fakeFetch }
    });
  });
  after(() => t.close());

  const post = async (event, headers = {}) => {
    const body = JSON.stringify(event);
    const res = await fetch(t.base + '/api/billing/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sign(body), ...headers }, body });
    return { status: res.status, json: await res.json() };
  };
  let evCounter = 0;
  const event = (type, object, created = Math.floor(Date.now() / 1000)) => ({ id: `evt_${++evCounter}`, type, created, data: { object } });
  const planOf = (id) => t.deps.repos.users.byId(id);

  test('capability is advertised and checkout needs a session', async () => {
    const c = t.client();
    assert.equal((await t.client().post('/api/billing/checkout', {})).status, 401);
    await registerUser(c);
    assert.equal((await c.get('/api/auth/me')).json.capabilities.billing, true);
  });

  test('creates a Checkout Session with the right price, metadata and return URLs', async () => {
    calls = [];
    const c = t.client();
    const { user } = await registerUser(c);
    const r = await c.post('/api/billing/checkout', { interval: 'year' });
    assert.equal(r.status, 200);
    assert.match(r.json.url, /^https:\/\/checkout\.stripe\.com\//);
    const call = calls[0];
    assert.equal(call.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(call.init.headers.Authorization, 'Bearer sk_test_x');
    const body = new URLSearchParams(call.init.body);
    assert.equal(body.get('mode'), 'subscription');
    assert.equal(body.get('line_items[0][price]'), 'price_year');
    assert.equal(body.get('client_reference_id'), user.id);
    assert.equal(body.get('subscription_data[metadata][user_id]'), user.id);
    assert.equal(body.get('success_url'), 'https://app.example.com/style?section=account&upgraded=1');
    assert.equal(body.get('cancel_url'), 'https://app.example.com/pro');
    assert.ok(body.get('customer_email'));
    const monthly = await c.post('/api/billing/checkout', { interval: 'month' });
    assert.equal(new URLSearchParams(calls[1].init.body).get('line_items[0][price]'), 'price_month');
    assert.equal(monthly.status, 200);
  });

  test('provider errors become a clean message with no secrets', async () => {
    const c = t.client();
    await registerUser(c);
    stripeReply = () => ({ ok: false, status: 400, json: async () => ({ error: { type: 'invalid_request_error', message: 'No such price: sk_test_x' } }) });
    const r = await c.post('/api/billing/checkout', {});
    assert.equal(r.status, 502);
    assert.ok(!r.text.includes('sk_test_x'));
    stripeReply = () => { throw new Error('ECONNRESET'); };
    assert.equal((await c.post('/api/billing/checkout', {})).status, 503);
    stripeReply = () => ({ ok: true, status: 200, json: async () => ({ id: 'cs', url: 'https://checkout.stripe.com/x' }) });
  });

  test('webhooks without a valid signature are refused and change nothing', async () => {
    const c = t.client();
    const { user } = await registerUser(c);
    const ev = event('checkout.session.completed', { mode: 'subscription', client_reference_id: user.id, customer: 'cus_1', subscription: 'sub_1' });
    assert.equal((await post(ev, { 'stripe-signature': 'nope' })).status, 400);
    assert.equal((await post(ev, { 'stripe-signature': sign(JSON.stringify(ev), { secret: 'wrong' }) })).status, 400);
    assert.equal(planOf(user.id).plan, 'free');
  });

  test('a completed checkout upgrades the account; entitlements follow', async () => {
    const c = t.client();
    const { user } = await registerUser(c);
    const r = await post(event('checkout.session.completed', { mode: 'subscription', client_reference_id: user.id, customer: 'cus_A', subscription: 'sub_A' }));
    assert.equal(r.status, 200);
    const u = planOf(user.id);
    assert.equal(u.plan, 'pro');
    assert.equal(u.stripe_customer_id, 'cus_A');
    const me = (await c.get('/api/auth/me')).json;
    assert.equal(me.entitlements.plan, 'pro');
    assert.equal(me.entitlements.closetLimit, null);
    // already-active subscribers cannot start a second checkout
    t.deps.repos.users.setPlan(user.id, { plan: 'pro', status: 'active', customerId: 'cus_A' });
    assert.equal((await c.post('/api/billing/checkout', {})).status, 400);
  });

  test('subscription lifecycle: renewal date, past_due keeps access, cancellation removes it', async () => {
    const c = t.client();
    const { user } = await registerUser(c);
    t.deps.repos.users.setPlan(user.id, { plan: 'free', status: null, customerId: 'cus_B' });
    const base = Math.floor(Date.now() / 1000);
    const sub = (status, extra = {}) => ({ id: 'sub_B', customer: 'cus_B', status, metadata: { user_id: user.id }, current_period_end: base + 30 * 86400, ...extra });

    await post(event('customer.subscription.created', sub('active'), base));
    assert.equal(planOf(user.id).plan, 'pro');
    assert.equal(planOf(user.id).plan_renews_at, base + 30 * 86400);

    await post(event('customer.subscription.updated', sub('past_due'), base + 10));
    assert.equal(planOf(user.id).plan, 'pro');
    assert.equal(planOf(user.id).plan_status, 'past_due');

    await post(event('customer.subscription.updated', sub('unpaid'), base + 20));
    assert.equal(planOf(user.id).plan, 'free');

    await post(event('customer.subscription.updated', sub('active', { current_period_end: undefined, items: { data: [{ current_period_end: base + 99 }] } }), base + 30));
    assert.equal(planOf(user.id).plan, 'pro');
    assert.equal(planOf(user.id).plan_renews_at, base + 99); // newer API shape

    await post(event('customer.subscription.deleted', sub('canceled'), base + 40));
    assert.equal(planOf(user.id).plan, 'free');
    assert.equal(planOf(user.id).plan_status, 'canceled');
  });

  test('duplicate and out-of-order deliveries are harmless', async () => {
    const c = t.client();
    const { user } = await registerUser(c);
    const base = Math.floor(Date.now() / 1000);
    const sub = (status) => ({ id: 'sub_C', customer: 'cus_C', status, metadata: { user_id: user.id }, current_period_end: base + 1000 });
    const created = event('customer.subscription.created', sub('active'), base);
    const deleted = event('customer.subscription.deleted', sub('canceled'), base + 50);
    await post(created);
    await post(deleted);
    // the older "created" event is redelivered after "deleted": it must not resurrect Pro
    assert.equal((await post(created)).status, 200); // duplicate id: ignored
    const stale = event('customer.subscription.updated', sub('active'), base + 10); // new id but older timestamp
    assert.equal((await post(stale)).status, 200);
    assert.equal(planOf(user.id).plan, 'free');
  });

  test('events for unknown customers and unrelated types are acknowledged without effect', async () => {
    assert.equal((await post(event('customer.subscription.updated', { id: 'sub_X', customer: 'cus_unknown', status: 'active' }))).status, 200);
    assert.equal((await post(event('invoice.paid', {}))).status, 200);
  });

  test('portal needs a customer id; deleting the account cancels the subscription', async () => {
    const c = t.client();
    const { user, password } = await registerUser(c);
    assert.equal((await c.post('/api/billing/portal', {})).status, 400);
    t.deps.repos.users.setPlan(user.id, { plan: 'pro', status: 'active', customerId: 'cus_D', subscriptionId: 'sub_D' });
    calls = [];
    stripeReply = () => ({ ok: true, status: 200, json: async () => ({ url: 'https://billing.stripe.com/session/x' }) });
    const p = await c.post('/api/billing/portal', {});
    assert.equal(p.status, 200);
    assert.equal(new URLSearchParams(calls[0].init.body).get('customer'), 'cus_D');
    calls = [];
    assert.equal((await c.del('/api/account', { password })).status, 200);
    assert.equal(calls[0].url, 'https://api.stripe.com/v1/subscriptions/sub_D');
    assert.equal(calls[0].init.method, 'DELETE');
  });
});

describe('billing not configured', () => {
  test('the app runs, advertises no billing and answers 503', async () => {
    const t = await startTestServer();
    try {
      const c = t.client();
      await registerUser(c);
      assert.equal((await c.get('/api/auth/me')).json.capabilities.billing, false);
      assert.equal((await c.post('/api/billing/checkout', {})).status, 503);
    } finally {
      await t.close();
    }
  });
});
