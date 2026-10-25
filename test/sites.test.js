import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

describe('side-project sites', () => {
  let t;
  before(async () => {
    t = await startTestServer();
  });
  after(() => t.close());

  test('/cities/philadelphia serves the Philadelphia map with its own CSP, kept out of search', async () => {
    const res = await t.client().raw('GET', '/cities/philadelphia/', undefined, { accept: 'text/html' });
    assert.equal(res.status, 200);
    assert.match(res.text, /<canvas|<script/);
    assert.doesNotMatch(res.text, /ModaWard/);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self' 'unsafe-inline'/);
    assert.match(res.headers.get('content-security-policy'), /connect-src 'self' https:\/\/graph\.mapillary\.com/, 'street photos come from Mapillary');
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    const meta = await t.client().raw('GET', '/cities/philadelphia/meta.json');
    assert.equal(meta.status, 200);
    assert.ok(JSON.parse(meta.text).N > 0);
  });

  test('/cities/nyc serves the New York map and its data', async () => {
    const res = await t.client().raw('GET', '/cities/nyc/', undefined, { accept: 'text/html' });
    assert.equal(res.status, 200);
    assert.match(res.text, /New York in Layers/);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    const meta = JSON.parse((await t.client().raw('GET', '/cities/nyc/meta.json')).text);
    assert.ok(meta.N > 800000);
    for (const p of meta.geom) assert.equal((await t.client().raw('GET', '/cities/nyc/' + p.file)).status, 200, p.file);
    const lm = JSON.parse((await t.client().raw('GET', '/cities/nyc/landmarks.json')).text);
    assert.equal(Object.keys(lm).length, 25);
  });

  test('without the trailing slash it redirects, so the page’s relative files resolve', async () => {
    const res = await t.client().raw('GET', '/cities/philadelphia', undefined, { accept: 'text/html' });
    assert.ok([301, 302, 308].includes(res.status), `status ${res.status}`);
    assert.equal(res.headers.get('location'), '/cities/philadelphia/');
  });

  test('/cities lists the city maps', async () => {
    const res = await t.client().raw('GET', '/cities/', undefined, { accept: 'text/html' });
    assert.equal(res.status, 200);
    assert.match(res.text, /href="philadelphia\/"/);
    assert.match(res.text, /href="nyc\/"/);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  });

  test('the old /phillyproject address redirects to the map, keeping the path', async () => {
    for (const [from, to] of [['/phillyproject', '/cities/philadelphia/'], ['/phillyproject/', '/cities/philadelphia/'], ['/phillyproject/meta.json', '/cities/philadelphia/meta.json']]) {
      const res = await t.client().raw('GET', from, undefined, { accept: 'text/html' });
      assert.equal(res.status, 301, from);
      assert.equal(res.headers.get('location'), to, from);
    }
  });

  test('the app itself keeps its strict CSP', async () => {
    const res = await t.client().raw('GET', '/closet', undefined, { accept: 'text/html' });
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'(;|$)/);
  });
});
