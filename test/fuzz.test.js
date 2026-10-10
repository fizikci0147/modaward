import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestServer, registerUser, NYC } from './helpers.js';

const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/http/routes');

/** Every API route, hit with hostile input as an admin, a normal user and a stranger: none may answer 5xx. */
describe('hostile input never causes a server error', () => {
  let t;
  before(async () => {
    t = await startTestServer({ env: { ADMIN_EMAILS: 'fuzz-admin@example.com', AUTH_RATE_MAX: '1000000', API_RATE_MAX: '1000000' } });
  });
  after(() => t.close());

  test('all routes × admin / user / anonymous × hostile bodies and query strings', async () => {
    const routes = [];
    for (const f of fs.readdirSync(routesDir)) {
      for (const m of fs.readFileSync(path.join(routesDir, f), 'utf8').matchAll(/\br\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) routes.push([m[1].toUpperCase(), m[2]]);
    }
    assert.ok(routes.length > 50, `found ${routes.length} routes`);
    const admin = t.client();
    await registerUser(admin, { email: 'fuzz-admin@example.com' });
    const user = t.client();
    await registerUser(user);
    for (const c of [admin, user]) {
      await c.patch('/api/profile', { location: NYC, department: 'women' });
      await c.post('/api/garments/starter', {});
    }
    const gid = (await user.get('/api/garments')).json.garments[0].id;
    const fill = (p) => p.replace(':id', gid).replace(':date', '2026-10-06').replace(':name', 'x.jpg').replace(/:\w+/g, 'x');
    const big = 'A'.repeat(20000);
    const bodies = [
      {},
      [],
      null,
      'text',
      JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}'),
      { email: big, password: big, name: big, image: big, text: big, title: big, note: big, occasion: big },
      { price: 'NaN', days: -1, hour: 1e308, lat: 'x', lon: [], occasions: 'casual', itemIds: [null, {}, 5], date: { x: 1 }, signal: [], count: 1e9, type: { a: 1 }, color: ['#fff'], retailer: 7 },
      { email: 'a@b.co', password: '\u0000\ud800', text: 'a,b\n"c', retailer: 'zara' }
    ];
    const failures = [];
    for (const [who, c] of [['admin', admin], ['user', user], ['anonymous', t.client()]]) {
      for (const [method, p] of routes) {
        if (method === 'DELETE' && p === '/account') continue; // would really delete the account
        for (const body of method === 'GET' ? [undefined] : bodies) {
          let url = `/api${fill(p)}`;
          if (method === 'GET' || method === 'DELETE') url += `?date=%E0%A4%A&q=${'x'.repeat(300)}&from=zz&to=1&page=-5&tz=abc&today=nope`;
          const res = await c.raw(method, url, body);
          if (res.status >= 500 && res.status !== 503) failures.push(`${who} ${method} ${p} ← ${JSON.stringify(body)?.slice(0, 60)} → ${res.status}`);
        }
      }
    }
    assert.deepEqual([...new Set(failures)].slice(0, 20), []);
    assert.equal((await t.client().get('/health')).status, 200);
  });
});
