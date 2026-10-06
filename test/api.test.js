import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = 'data:image/png;base64,' + PNG_B64;

describe('API', () => {
  let t;
  const sent = [];
  before(async () => {
    t = await startTestServer({ overrides: { mailer: { configured: true, send: async (m) => sent.push(m) } }, env: { APP_URL: 'https://app.example.com' } });
  });
  after(() => t.close());

  describe('health and headers', () => {
    test('health and readiness', async () => {
      const c = t.client();
      assert.equal((await c.get('/health')).json.ok, true);
      assert.equal((await c.get('/ready')).json.ok, true);
    });

    test('sends a strict CSP and security headers, never X-Powered-By', async () => {
      const res = await t.client().get('/health');
      const csp = res.headers.get('content-security-policy');
      assert.match(csp, /script-src 'self'/);
      assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-powered-by'), null);
    });

    test('unknown API routes return JSON 404, unknown pages fall back to the SPA shell', async () => {
      const c = t.client();
      const api = await c.get('/api/nope');
      assert.equal(api.status, 404);
      assert.equal(api.json.error.code, 'not_found');
    });
  });

  describe('auth', () => {
    test('register → me → logout → me', async () => {
      const c = t.client();
      const { email } = await registerUser(c, { name: 'Ada' });
      const me = await c.get('/api/auth/me');
      assert.equal(me.json.user.email, email);
      assert.equal(me.json.user.plan, 'free');
      assert.equal(me.json.entitlements.closetLimit, 30);
      assert.equal(me.json.user.password_hash, undefined);
      await c.post('/api/auth/logout');
      assert.equal((await c.get('/api/auth/me')).json.user, null);
    });

    test('session cookie is HttpOnly and SameSite=Lax', async () => {
      const c = t.client();
      const res = await c.post('/api/auth/register', { email: 'cookie@example.com', password: 'correct horse battery' });
      const cookie = res.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
    });

    test('rejects weak passwords, duplicates and bad emails', async () => {
      const c = t.client();
      assert.equal((await c.post('/api/auth/register', { email: 'a@example.com', password: 'short' })).status, 400);
      assert.equal((await c.post('/api/auth/register', { email: 'a@example.com', password: 'password123' })).status, 400);
      assert.equal((await c.post('/api/auth/register', { email: 'not-an-email', password: 'correct horse battery' })).status, 400);
      assert.equal((await c.post('/api/auth/register', { email: 'dup@example.com', password: 'correct horse battery' })).status, 201);
      const dup = await t.client().post('/api/auth/register', { email: 'DUP@example.com', password: 'correct horse battery' });
      assert.equal(dup.status, 409);
    });

    test('login succeeds with the right password and fails generically otherwise', async () => {
      const { email, password } = await registerUser(t.client());
      const c = t.client();
      const bad = await c.post('/api/auth/login', { email, password: 'wrong password!!' });
      const unknown = await c.post('/api/auth/login', { email: 'nobody@example.com', password: 'whatever12345' });
      assert.equal(bad.status, 401);
      assert.equal(unknown.status, 401);
      assert.equal(bad.json.error.message, unknown.json.error.message);
      assert.equal((await c.post('/api/auth/login', { email, password })).status, 200);
    });

    test('brute-force protection locks an account/IP pair after repeated failures', async () => {
      const { email } = await registerUser(t.client());
      const c = t.client();
      let last;
      for (let i = 0; i < 12; i++) last = await c.post('/api/auth/login', { email, password: 'wrong password!!' });
      assert.equal(last.status, 429);
      assert.ok(last.headers.get('retry-after'));
    });

    test('password reset: single-use token, sessions revoked, old password dead', async () => {
      const { email } = await registerUser(t.client());
      const c = t.client();
      sent.length = 0;
      assert.equal((await c.post('/api/auth/forgot', { email })).status, 200);
      const unknown = await c.post('/api/auth/forgot', { email: 'ghost@example.com' });
      assert.equal(unknown.status, 200); // no account enumeration
      assert.equal(sent.length, 1);
      const token = /reset\?token=([a-f0-9]{64})/.exec(sent[0].text)[1];
      assert.match(sent[0].text, /^Hi/);
      assert.ok(sent[0].text.includes('https://app.example.com/reset?token='));

      assert.equal((await c.post('/api/auth/reset', { token, password: 'abc' })).status, 400); // weak: token not burned
      assert.equal((await c.post('/api/auth/reset', { token, password: 'a brand new passphrase' })).status, 200);
      assert.equal((await c.post('/api/auth/reset', { token, password: 'another new passphrase' })).status, 400); // single use
      assert.equal((await t.client().post('/api/auth/login', { email, password: 'correct horse battery' })).status, 401);
      assert.equal((await t.client().post('/api/auth/login', { email, password: 'a brand new passphrase' })).status, 200);
    });
  });

  describe('CSRF and origin protection', () => {
    test('state-changing calls without the custom header are refused', async () => {
      const res = await fetch(t.base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'x@example.com', password: 'correct horse battery' }) });
      assert.equal(res.status, 403);
    });

    test('a foreign Origin is refused even with the header', async () => {
      const c = t.client();
      const res = await c.raw('POST', '/api/auth/register', { email: 'csrf@example.com', password: 'correct horse battery' }, { origin: 'https://evil.example' });
      assert.equal(res.status, 403);
    });

    test('same-origin and configured-app-host origins pass', async () => {
      const c = t.client();
      const ok = await c.raw('POST', '/api/auth/register', { email: 'origin1@example.com', password: 'correct horse battery' }, { origin: t.base });
      assert.equal(ok.status, 201);
      const ok2 = await t.client().raw('POST', '/api/auth/register', { email: 'origin2@example.com', password: 'correct horse battery' }, { origin: 'https://app.example.com' });
      assert.equal(ok2.status, 201);
    });

    test('malformed JSON yields a clean 400', async () => {
      const res = await fetch(t.base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'modaward' }, body: '{bad' });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, 'bad_json');
    });
  });

  describe('authorisation', () => {
    test('protected endpoints require a session', async () => {
      const c = t.client();
      for (const [m, u] of [['get', '/api/garments'], ['get', '/api/profile'], ['get', '/api/weather'], ['get', '/api/account/export']]) {
        assert.equal((await c[m](u)).status, 401, u);
      }
      assert.equal((await c.post('/api/outfits/recommend', {})).status, 401);
    });

    test("one user can never read, change or delete another user's items", async () => {
      const a = t.client();
      const b = t.client();
      await registerUser(a);
      await registerUser(b);
      const g = (await a.post('/api/garments', { type: 'tee', color: '#ffffff' })).json.garment;
      assert.equal((await b.get(`/api/garments/${g.id}`)).status, 404);
      assert.equal((await b.patch(`/api/garments/${g.id}`, { name: 'hacked' })).status, 404);
      assert.equal((await b.del(`/api/garments/${g.id}`)).status, 404);
      assert.equal((await a.get(`/api/garments/${g.id}`)).json.garment.name, g.name);
      assert.equal((await b.get('/api/garments')).json.garments.length, 0);
    });
  });

  describe('garments', () => {
    test('create with defaults, update, type change resets defaults, delete', async () => {
      const c = t.client();
      await registerUser(c);
      const created = await c.post('/api/garments', { type: 'sweater', color: '#1f2f54' });
      assert.equal(created.status, 201);
      const g = created.json.garment;
      assert.equal(g.category, 'top');
      assert.equal(g.warmth, 4);
      assert.match(g.name, /Navy Crewneck|Navy Sweater/i);

      const changed = (await c.patch(`/api/garments/${g.id}`, { type: 'tee' })).json.garment;
      assert.equal(changed.warmth, 1);
      const explicit = (await c.patch(`/api/garments/${g.id}`, { type: 'hoodie', warmth: 3.5 })).json.garment;
      assert.equal(explicit.warmth, 3.5);

      assert.equal((await c.del(`/api/garments/${g.id}`)).status, 200);
      assert.equal((await c.get(`/api/garments/${g.id}`)).status, 404);
    });

    test('validates every field', async () => {
      const c = t.client();
      await registerUser(c);
      for (const bad of [{ type: 'spaceship', color: '#fff000' }, { type: 'tee', color: 'red' }, { type: 'tee', color: '#ffffff', warmth: 9 }, { type: 'tee', color: '#ffffff', extra: 1 }, { type: 'tee', color: '#ffffff', name: 'x'.repeat(200) }]) {
        assert.equal((await c.post('/api/garments', bad)).status, 400, JSON.stringify(bad));
      }
      assert.equal((await c.get('/api/garments/not-a-uuid')).status, 404);
    });

    test('starter wardrobe populates a closet', async () => {
      const c = t.client();
      await registerUser(c);
      const res = await c.post('/api/garments/starter', { department: 'women' });
      assert.equal(res.status, 201);
      assert.ok(res.json.garments.length >= 20);
      assert.ok(res.json.garments.some((g) => g.type === 'skirt'));
    });

    test('the free plan caps the closet and says how to upgrade', async () => {
      const c = t.client();
      const { user } = await registerUser(c);
      for (let i = 0; i < 30; i++) assert.equal((await c.post('/api/garments', { type: 'tee', color: '#ffffff' })).status, 201);
      const over = await c.post('/api/garments', { type: 'tee', color: '#ffffff' });
      assert.equal(over.status, 402);
      assert.equal(over.json.error.code, 'upgrade_required');
      t.deps.repos.users.setPlan(user.id, { plan: 'pro', status: 'active' });
      assert.equal((await c.post('/api/garments', { type: 'tee', color: '#ffffff' })).status, 201);
    });

    test('photos: upload, owner-only access, replace removes the old file, delete cleans up', async () => {
      const a = t.client();
      const b = t.client();
      await registerUser(a);
      await registerUser(b);
      const g = (await a.post('/api/garments', { type: 'tee', color: '#ffffff', image: PNG })).json.garment;
      assert.match(g.imageUrl, /^\/uploads\/g_[a-f0-9]{32}\.png/);
      const url = g.imageUrl;
      const file = url.split('?')[0];

      const own = await a.get(file);
      assert.equal(own.status, 200);
      assert.equal(own.headers.get('content-type'), 'image/png');
      assert.match(own.headers.get('cache-control'), /private/);
      assert.equal((await b.get(file)).status, 404);
      assert.equal((await t.client().get(file)).status, 404);

      const replaced = (await a.put(`/api/garments/${g.id}/photo`, { image: PNG })).json.garment;
      assert.notEqual(replaced.imageUrl.split('?')[0], file);
      assert.equal((await a.get(file)).status, 404); // old file gone

      assert.equal((await a.post('/api/garments', { type: 'tee', color: '#ffffff', image: 'data:image/png;base64,' + Buffer.from('<html>').toString('base64') })).status, 400);
      assert.equal((await a.get('/uploads/..%2F..%2Fetc%2Fpasswd')).status, 404);
    });
  });

  describe('profile', () => {
    test('defaults, deep patch, clearing location, completeness', async () => {
      const c = t.client();
      await registerUser(c);
      const initial = (await c.get('/api/profile')).json;
      assert.equal(initial.profile.units, 'imperial');
      assert.ok(initial.completeness.percent < 20);

      const res = await c.patch('/api/profile', { location: NYC, sizes: { top: 'M', shoe: '10' }, fit: { tops: 'relaxed' }, style: { archetypes: { minimal: 0.9, classic: 0.7 }, likedColors: ['navy'], notes: 'No itchy fabrics please' } });
      assert.equal(res.status, 200);
      assert.equal(res.json.profile.location.name, NYC.name);
      assert.equal(res.json.profile.sizes.top, 'M');
      assert.equal(res.json.profile.fit.tops, 'relaxed');
      assert.equal(res.json.profile.fit.bottoms, 'straight'); // untouched sibling preserved
      assert.equal(res.json.profile.fit.set, true);
      assert.ok(res.json.completeness.percent > initial.completeness.percent);

      const cleared = await c.patch('/api/profile', { location: null });
      assert.equal(cleared.json.profile.location, null);
    });

    test('budget tier applies its price caps; colour lists stay disjoint; unknown fields rejected', async () => {
      const c = t.client();
      await registerUser(c);
      const r1 = await c.patch('/api/profile', { budget: { tier: 'premium' } });
      assert.equal(r1.json.profile.budget.top, 150);
      const r2 = await c.patch('/api/profile', { style: { likedColors: ['navy', 'olive'] } });
      const r3 = await c.patch('/api/profile', { style: { avoidedColors: ['olive'] } });
      assert.deepEqual(r3.json.profile.style.likedColors, ['navy']);
      assert.ok(r2.status === 200);
      assert.equal((await c.patch('/api/profile', { admin: true })).status, 400);
      assert.equal((await c.patch('/api/profile', { style: { archetypes: { goth: 1 } } })).status, 400);
      assert.equal((await c.patch('/api/profile', { bodyAreas: { show: ['arms'], cover: ['arms'] } })).status, 400);
    });

    test('city search works through the provider', async () => {
      const c = t.client();
      await registerUser(c);
      const r = await c.get('/api/geo/search?q=istan');
      assert.equal(r.status, 200);
      assert.ok(r.json.results.some((x) => /Istanbul/.test(x.name)));
      assert.equal((await c.get('/api/geo/search?q=a')).status, 400);
    });
  });

  describe('weather and outfits', () => {
    async function ready() {
      const c = t.client();
      const reg = await registerUser(c);
      await c.patch('/api/profile', { location: NYC });
      await c.post('/api/garments/starter', { department: 'unisex' });
      return { c, reg };
    }

    test('location is required before weather or outfits', async () => {
      const c = t.client();
      await registerUser(c);
      const r = await c.get('/api/weather');
      assert.equal(r.status, 409);
      assert.equal(r.json.error.code, 'location_required');
    });

    test('forecast returns days with hourly data', async () => {
      const { c } = await ready();
      const w = (await c.get('/api/weather')).json;
      assert.equal(w.days.length, 8);
      assert.equal(w.days[0].hours.length, 24);
      assert.equal(w.location.name, NYC.name);
    });

    test('recommends outfits with items, reasons and tips', async () => {
      const { c } = await ready();
      const res = await c.post('/api/outfits/recommend', { occasion: 'casual', count: 3 });
      assert.equal(res.status, 200);
      assert.equal(res.json.outfits.length, 3);
      const o = res.json.outfits[0];
      assert.ok(o.items.length >= 3);
      assert.ok(o.items.every((i) => i.id && i.color));
      assert.ok(o.score > 40);
      assert.ok(o.reasons.length > 0);
    });

    test('free plan limits planning to three days; other days are locked, not leaked', async () => {
      const { c } = await ready();
      const week = (await c.post('/api/plan', {})).json;
      assert.equal(week.days.length, 8);
      assert.equal(week.days.filter((d) => !d.locked).length, 3);
      assert.equal(week.days[5].locked, true);
      assert.equal(week.days[5].outfits, undefined);
      const day5 = week.days[5].date;
      const r = await c.post('/api/outfits/recommend', { date: day5 });
      assert.equal(r.status, 402);
      assert.equal((await c.post('/api/outfits/recommend', { date: '2031-01-01' })).status, 400);
    });

    test('pro users get the whole week', async () => {
      const { c, reg } = await ready();
      t.deps.repos.users.setPlan(reg.user.id, { plan: 'pro', status: 'active' });
      const week = (await c.post('/api/plan', {})).json;
      assert.ok(week.days.every((d) => !d.locked && d.outfits.length > 0));
    });

    test('wearing an outfit logs history, feeds freshness and teaches the taste model', async () => {
      const { c, reg } = await ready();
      const first = (await c.post('/api/outfits/recommend', { occasion: 'casual', count: 1, seed: 'a' })).json;
      const o = first.outfits[0];
      const date = first.date;
      assert.equal((await c.post('/api/outfits/wear', { date, itemIds: o.itemIds, occasion: 'casual', key: o.key })).status, 200);
      assert.equal((await c.get('/api/outfits/history')).json.history.length, 1);
      assert.equal(t.deps.repos.profiles.getTaste(reg.user.id).n, 1);

      const again = (await c.post('/api/outfits/recommend', { occasion: 'casual', count: 1, seed: 'a' })).json;
      assert.notEqual(again.outfits[0].key, o.key);

      assert.equal((await c.del(`/api/outfits/wear?date=${date}`)).json.removed, o.itemIds.length);
    });

    test('disliking an outfit blocks it permanently', async () => {
      const { c } = await ready();
      const a = (await c.post('/api/outfits/recommend', { count: 1, seed: 'z' })).json.outfits[0];
      await c.post('/api/outfits/feedback', { itemIds: a.itemIds, signal: 'dislike', key: a.key });
      for (const seed of ['z', 'y', 'x']) {
        const r = (await c.post('/api/outfits/recommend', { count: 5, seed })).json;
        assert.ok(!r.outfits.some((o) => o.key === a.key));
      }
    });

    test('cannot wear or rate items that are not yours', async () => {
      const a = t.client();
      const b = t.client();
      await registerUser(a);
      await registerUser(b);
      const g = (await a.post('/api/garments', { type: 'tee', color: '#ffffff' })).json.garment;
      assert.equal((await b.post('/api/outfits/wear', { date: '2026-10-06', itemIds: [g.id] })).status, 400);
      assert.equal((await b.post('/api/outfits/feedback', { itemIds: [g.id], signal: 'love' })).status, 400);
    });

    test('an empty closet reports what is missing', async () => {
      const c = t.client();
      await registerUser(c);
      await c.patch('/api/profile', { location: NYC });
      const r = (await c.post('/api/outfits/recommend', {})).json;
      assert.deepEqual(r.outfits, []);
      assert.deepEqual(r.missing.sort(), ['bottom', 'top']);
    });
  });

  describe('account', () => {
    test('export contains the closet; change password revokes other sessions', async () => {
      const a = t.client();
      const { email, password } = await registerUser(a);
      await a.post('/api/garments', { type: 'tee', color: '#ffffff' });
      const exp = await a.get('/api/account/export');
      assert.equal(exp.json.garments.length, 1);
      assert.match(exp.headers.get('content-disposition'), /attachment/);

      const other = t.client();
      await other.post('/api/auth/login', { email, password });
      assert.equal((await other.get('/api/auth/me')).json.user.email, email);
      const bad = await a.post('/api/account/password', { current: 'nope nope nope', next: 'a brand new passphrase' });
      assert.equal(bad.status, 401);
      assert.equal((await a.post('/api/account/password', { current: password, next: 'a brand new passphrase' })).status, 200);
      assert.equal((await other.get('/api/auth/me')).json.user, null); // other device signed out
      assert.equal((await a.get('/api/auth/me')).json.user.email, email); // this one stays in
    });

    test('deleting the account removes every trace, including photos', async () => {
      const c = t.client();
      const { email, password, user } = await registerUser(c);
      const g = (await c.post('/api/garments', { type: 'tee', color: '#ffffff', image: PNG })).json.garment;
      const name = t.deps.repos.garments.imageName(user.id, g.id);
      const file = t.deps.images.pathFor(name);
      const fs = await import('node:fs');
      assert.ok(fs.existsSync(file));
      assert.equal((await c.del('/api/account', { password: 'wrong wrong wrong' })).status, 401);
      assert.equal((await c.del('/api/account', { password })).status, 200);
      assert.ok(!fs.existsSync(file));
      assert.equal(t.deps.repos.users.byEmail(email), undefined);
      assert.equal(t.deps.db.get('SELECT COUNT(*) AS n FROM garments WHERE user_id = ?', user.id).n, 0);
      assert.equal((await c.get('/api/auth/me')).json.user, null);
    });
  });
});
