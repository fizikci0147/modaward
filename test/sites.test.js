import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

describe('side-project sites', () => {
  let t;
  before(async () => {
    t = await startTestServer();
  });
  after(() => t.close());

  test('/phillyproject serves the Philadelphia map with its own CSP, kept out of search', async () => {
    const res = await t.client().raw('GET', '/phillyproject/', undefined, { accept: 'text/html' });
    assert.equal(res.status, 200);
    assert.match(res.text, /<canvas|<script/);
    assert.doesNotMatch(res.text, /ModaWard/);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self' 'unsafe-inline'/);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    const meta = await t.client().raw('GET', '/phillyproject/meta.json');
    assert.equal(meta.status, 200);
    assert.ok(JSON.parse(meta.text).N > 0);
  });

  test('without the trailing slash it redirects, so the page’s relative files resolve', async () => {
    const res = await t.client().raw('GET', '/phillyproject', undefined, { accept: 'text/html' });
    assert.ok([301, 302, 308].includes(res.status), `status ${res.status}`);
    assert.equal(res.headers.get('location'), '/phillyproject/');
  });

  test('the app itself keeps its strict CSP', async () => {
    const res = await t.client().raw('GET', '/closet', undefined, { accept: 'text/html' });
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'(;|$)/);
  });
});
