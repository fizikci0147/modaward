import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser } from './helpers.js';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = 'data:image/png;base64,' + PNG_B64;

describe('remove.bg fallback', () => {
  let t;
  let fetchCalls = [];
  let mode = 'ok';
  before(async () => {
    const fakeFetch = async (url, init) => {
      fetchCalls.push({ url, init });
      if (mode === 'ok') return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(PNG_B64, 'base64') };
      if (mode === '402') return { ok: false, status: 402, json: async () => ({ errors: [{ title: 'Insufficient credits' }] }) };
      if (mode === 'bad') return { ok: true, status: 200, arrayBuffer: async () => Buffer.from('<html>nope</html>') };
      if (mode === 'down') throw new Error('ECONNRESET');
      return { ok: false, status: 400, json: async () => ({ errors: [{ title: 'Could not identify foreground' }] }) };
    };
    t = await startTestServer({ env: { REMOVEBG_API_KEY: 'test-key', CUTOUT_DAILY_LIMIT: '3' }, overrides: { fetch: fakeFetch } });
  });
  after(() => t.close());

  const pro = async () => {
    const c = t.client();
    const { user } = await registerUser(c);
    t.deps.repos.users.setPlan(user.id, { plan: 'pro', status: 'active' });
    return c;
  };

  test('is advertised as a capability and gated to Pro', async () => {
    const free = t.client();
    await registerUser(free);
    assert.equal((await free.get('/api/auth/me')).json.capabilities.cutoutService, true);
    const r = await free.post('/api/photos/cutout', { image: PNG });
    assert.equal(r.status, 402);
    assert.equal((await t.client().post('/api/photos/cutout', { image: PNG })).status, 401);
  });

  test('sends the image to remove.bg with the key and returns a PNG data URL', async () => {
    mode = 'ok';
    fetchCalls = [];
    const c = await pro();
    const r = await c.post('/api/photos/cutout', { image: PNG });
    assert.equal(r.status, 200);
    assert.match(r.json.image, /^data:image\/png;base64,/);
    assert.equal(fetchCalls[0].url, 'https://api.remove.bg/v1.0/removebg');
    assert.equal(fetchCalls[0].init.headers['X-Api-Key'], 'test-key');
    assert.equal(fetchCalls[0].init.body.get('format'), 'png');
    assert.ok(fetchCalls[0].init.body.get('image_file_b64'));
  });

  test('maps provider failures to friendly errors and never leaks the key', async () => {
    for (const [m, status] of [['402', 503], ['fail', 422], ['bad', 502], ['down', 503]]) {
      mode = m;
      const c = await pro(); // fresh user: failed calls still count towards a user's daily cap
      const r = await c.post('/api/photos/cutout', { image: PNG });
      assert.equal(r.status, status, m);
      assert.ok(!r.text.includes('test-key'));
    }
  });

  test('rejects non-images before spending a call, and enforces the daily cap', async () => {
    mode = 'ok';
    const c = await pro();
    assert.equal((await c.post('/api/photos/cutout', { image: 'data:image/png;base64,' + Buffer.from('<script>').toString('base64') })).status, 400);
    for (let i = 0; i < 3; i++) assert.equal((await c.post('/api/photos/cutout', { image: PNG })).status, 200);
    const over = await c.post('/api/photos/cutout', { image: PNG });
    assert.equal(over.status, 429);
  });
});

describe('without a key', () => {
  test('the capability is off and the endpoint explains itself', async () => {
    const t = await startTestServer();
    try {
      const c = t.client();
      const { user } = await registerUser(c);
      assert.equal((await c.get('/api/auth/me')).json.capabilities.cutoutService, false);
      t.deps.repos.users.setPlan(user.id, { plan: 'pro', status: 'active' });
      assert.equal((await c.post('/api/photos/cutout', { image: PNG })).status, 503);
    } finally {
      await t.close();
    }
  });
});
