import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';

describe('security hardening', () => {
  let t;
  const sent = [];
  let billingFails = false;
  before(async () => {
    t = await startTestServer({
      env: { APP_URL: 'https://app.example.com', AUTH_RATE_MAX: '10000', API_RATE_MAX: '100000' },
      overrides: {
        mailer: { configured: true, send: async (m) => (sent.push(m), { delivered: true }) },
        billing: { cancelForUser: async () => { if (billingFails) throw new Error('stripe down'); }, createCheckout: async () => ({}), createPortal: async () => ({}), webhook: (_req, res) => res.sendStatus(200) }
      }
    });
  });
  after(() => t.close());

  test('reset emails cannot carry HTML from a name', async () => {
    const c = t.client();
    const { email } = await registerUser(c, { name: '<a href="https://evil.test">Confirm here</a>' });
    sent.length = 0;
    await t.client().post('/api/auth/forgot', { email });
    assert.equal(sent.length, 1);
    assert.doesNotMatch(sent[0].html, /<a href="https:\/\/evil\.test"/);
    assert.match(sent[0].html, /&lt;a href=&quot;https:\/\/evil\.test&quot;&gt;/);
    assert.match(sent[0].html, /<a href="https:\/\/app\.example\.com\/reset\?token=[a-f0-9]{64}">/);
  });

  test('reset requests are capped per recipient, whoever asks', async () => {
    const { email } = await registerUser(t.client());
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await t.client().post('/api/auth/forgot', { email })).status);
    // beyond the cap it answers exactly as before (so it can neither block a real reset nor reveal anything) but sends nothing
    assert.deepEqual(results, [200, 200, 200, 200, 200]);
    assert.equal(sent.filter((m) => m.to === email).length, 3);
    // somebody else is unaffected
    const other = await registerUser(t.client());
    assert.equal((await t.client().post('/api/auth/forgot', { email: other.email })).status, 200);
  });

  test('login, register, forgot and reset have their own limits', async () => {
    const small = await startTestServer({ env: { AUTH_RATE_MAX: '3' } });
    try {
      const c = small.client();
      for (let i = 0; i < 4; i++) await c.post('/api/auth/login', { email: `nobody${i}@example.com`, password: 'x'.repeat(12) });
      assert.equal((await c.post('/api/auth/login', { email: 'n@example.com', password: 'x'.repeat(12) })).status, 429, 'login is limited');
      const fresh = await c.post('/api/auth/register', { email: 'new@example.com', password: 'correct horse battery', name: 'N' });
      assert.equal(fresh.status, 201, 'but registering is not blocked by failed logins');
    } finally {
      await small.close();
    }
  });

  test('a malformed cookie or path is not a server error', async () => {
    const c = t.client();
    const me = await c.get('/api/auth/me', { cookie: 'mw_session=%E0%A4%A' });
    assert.equal(me.status, 200);
    assert.equal(me.json.user, null);
    const asset = await c.raw('GET', '/v/x/js/%E0%A4%A', undefined, { accept: 'application/json' });
    assert.notEqual(asset.status, 500);
    assert.notEqual((await c.raw('GET', '/js/%E0%A4%A.js', undefined, { accept: 'application/json' })).status, 500);
  });

  test('anonymous visitors cannot make the server read big bodies', async () => {
    const big = JSON.stringify({ image: 'x'.repeat(400_000) });
    const res = await t.client().raw('POST', '/api/garments', undefined, { 'content-type': 'application/json', 'x-requested-with': 'modaward' }).catch(() => null);
    assert.ok(res);
    const r = await fetch(`${t.base}/api/garments`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'modaward' }, body: big });
    assert.equal(r.status, 413);
    const admin = await fetch(`${t.base}/api/admin/products/import`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'modaward' }, body: JSON.stringify({ text: 'x'.repeat(300_000) }) });
    assert.equal(admin.status, 413);
  });

  test('archiving cannot be used to get around the closet limit', async () => {
    const c = t.client();
    const { user } = await registerUser(c);
    // fill the hard cap with archived rows, as a cheat would
    const repos = t.deps.repos;
    for (let i = 0; i < 100; i++) {
      const g = repos.garments.create(user.id, { name: 'Tee', type: 'tee', color: '#112233' });
      repos.garments.update(user.id, g.id, { archived: true });
    }
    assert.equal(repos.garments.count(user.id), 0, 'nothing is "in" the closet');
    const r = await c.post('/api/garments', { type: 'tee', color: '#112233' });
    assert.equal(r.status, 409);
    assert.match(r.json.error.message, /storage limit/);
    assert.equal((await c.post('/api/garments/starter', { department: 'men' })).status, 409);
    // deleting makes room again
    const one = repos.db.get('SELECT id FROM garments WHERE user_id = ? LIMIT 1', user.id).id;
    assert.equal((await c.del(`/api/garments/${one}`)).status, 200);
    assert.equal((await c.post('/api/garments', { type: 'tee', color: '#112233' })).status, 201);
  });

  test('deleting an account keeps it if the subscription cannot be cancelled', async () => {
    const c = t.client();
    const { user } = await registerUser(c);
    t.deps.repos.users.setPlan(user.id, { plan: 'pro', status: 'active', subscriptionId: 'sub_123', customerId: 'cus_123' });
    billingFails = true;
    const refused = await c.del('/api/account', { password: 'correct horse battery' });
    assert.equal(refused.status, 502);
    assert.match(refused.json.error.message, /not deleted/);
    assert.ok(t.deps.repos.users.byId(user.id), 'the account is still there');
    billingFails = false;
    assert.equal((await c.del('/api/account', { password: 'correct horse battery' })).status, 200);
    assert.equal(t.deps.repos.users.byId(user.id), undefined);
  });

  test('push: one person cannot pile up devices', async () => {
    const c = t.client();
    const { user } = await registerUser(c);
    for (let i = 0; i < 14; i++) {
      const r = await c.post('/api/reminders/push/subscribe', { endpoint: `https://fcm.googleapis.com/fcm/send/device-${i}-abcdefghijklmnop`, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } });
      assert.equal(r.status, 200);
    }
    assert.equal(t.deps.push.count(user.id), 10);
    assert.equal((await c.post('/api/reminders/push/subscribe', { endpoint: 'https://storage.googleapis.com/bucket/object-abcdefghijk', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } })).status, 400);
  });

  test('"send me a test", geo search and /go are rate limited', async () => {
    const c = t.client();
    await registerUser(c);
    await c.patch('/api/profile', { location: NYC });
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await c.post('/api/reminders/test', { kind: 'daily' })).status);
    assert.equal(statuses.filter((s) => s === 429).length, 2);
    let limited = 0;
    for (let i = 0; i < 45; i++) if ((await c.get('/api/geo/search?q=paris')).status === 429) limited += 1;
    assert.ok(limited >= 4, `geo limited ${limited}`);
    let goLimited = 0;
    for (let i = 0; i < 125; i++) if ((await fetch(`${t.base}/go?r=x&k=x&u=x&s=x`, { redirect: 'manual' })).status === 429) goLimited += 1;
    assert.ok(goLimited >= 4, `go limited ${goLimited}`);
  });

  test('mail bodies (they hold reset links) are not logged in production unless asked', async () => {
    for (const [env, expectBody] of [[{ NODE_ENV: 'test' }, true], [{ NODE_ENV: 'production', APP_URL: 'https://x.example.com', TRUST_PROXY: '1' }, false], [{ NODE_ENV: 'production', APP_URL: 'https://x.example.com', TRUST_PROXY: '1', LOG_MAIL_BODIES: '1' }, true]]) {
      const logged = [];
      const s = await startTestServer({ env, overrides: { mailer: undefined } });
      try {
        s.deps.log.warn = (event, data) => logged.push({ event, data });
        const { createMailer } = await import('../src/services/mailer.js');
        const mailer = createMailer(s.config, s.deps.log);
        await mailer.send({ to: 'a@example.com', subject: 'Reset', text: 'https://x.example.com/reset?token=secret', html: '' });
        const line = logged.find((l) => l.event === 'mail.not_configured');
        assert.ok(line);
        assert.equal(Boolean(line.data.preview), expectBody, JSON.stringify(env));
      } finally {
        await s.close();
      }
    }
  });

  test('browsers can report their own errors; only admins can read them; secrets are scrubbed', async () => {
    const anon = t.client();
    assert.equal((await anon.post('/api/client-errors', { message: 'x is not a function', stack: 'at f (https://app.example.com/v/1/js/a.js:1:1)?token=abc123secret', path: '/closet?code=zzz', build: '5.5.1-abc' })).status, 204);
    assert.equal((await anon.post('/api/client-errors', {})).status, 400);
    assert.equal((await anon.get('/api/admin/errors')).status, 401);
    const user = t.client();
    await registerUser(user);
    assert.equal((await user.get('/api/admin/errors')).status, 403);
    const row = t.deps.db.get('SELECT * FROM client_errors ORDER BY id DESC LIMIT 1');
    assert.equal(row.path, '/closet', 'query strings are dropped');
    assert.doesNotMatch(row.stack, /abc123secret/);
    let limited = 0;
    for (let i = 0; i < 20; i++) if ((await anon.post('/api/client-errors', { message: `e${i}` })).status === 429) limited += 1;
    assert.ok(limited > 0, 'reports are rate limited');
  });

  test('the session cookie is Secure in production even when the proxy hides HTTPS', async () => {
    const s = await startTestServer({ env: { NODE_ENV: 'production', APP_URL: 'https://x.example.com', TRUST_PROXY: '1' } });
    try {
      const res = await fetch(`${s.base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'modaward', 'x-forwarded-proto': 'http' }, body: JSON.stringify({ email: 'sec@example.com', password: 'correct horse battery', name: 'S' }) });
      assert.equal(res.status, 201);
      assert.match(res.headers.get('set-cookie'), /;\s*Secure/i);
    } finally {
      await s.close();
    }
  });
});
