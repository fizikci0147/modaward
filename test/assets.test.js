import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { createAssets, buildSegment } from '../src/http/assets.js';

describe('versioned front-end files', () => {
  let t;
  let seg;
  before(async () => {
    t = await startTestServer();
    seg = buildSegment(t.config.build.id);
  });
  after(() => t.close());

  const page = () => t.client().raw('GET', '/closet', undefined, { accept: 'text/html' });

  test('the page points at this build’s script and stylesheet', async () => {
    const { text, status } = await page();
    assert.equal(status, 200);
    assert.match(text, new RegExp(`src="/v/${seg}/js/main\\.js"`));
    assert.match(text, new RegExp(`href="/v/${seg}/css/app\\.css"`));
    assert.doesNotMatch(text, /src="\/js\/main\.js"/);
  });

  test('every absolute import inside a script is rewritten to the same build', async () => {
    for (const file of ['js/views/closet.js', 'js/app.js', 'js/ui.js', 'js/i18n.js', 'js/photo.js', 'shared/cutout.js']) {
      const res = await t.client().raw('GET', `/v/${seg}/${file}`);
      assert.equal(res.status, 200, file);
      assert.match(res.headers.get('content-type'), /javascript.*utf-8/i, file);
      assert.doesNotMatch(res.text, /(from\s*|import\s*\(\s*|new Worker\(\s*)['"`]\/(js|shared|vendor)\//, `${file} still has an unversioned import`);
    }
    const closet = (await t.client().raw('GET', `/v/${seg}/js/views/closet.js`)).text;
    assert.match(closet, new RegExp(`from '/v/${seg}/js/views/closet-insights\\.js'`));
    assert.match((await t.client().raw('GET', `/v/${seg}/js/i18n.js`)).text, new RegExp(`import\\(\`/v/${seg}/shared/locales/`));
    assert.match((await t.client().raw('GET', `/v/${seg}/js/photo.js`)).text, new RegExp(`new Worker\\('/v/${seg}/js/cutout-worker\\.js'`));
  });

  test('old addresses still work and repair themselves; an old build prefix gets the current code', async () => {
    const plain = await t.client().raw('GET', '/js/views/closet.js');
    assert.equal(plain.status, 200);
    assert.match(plain.text, new RegExp(`/v/${seg}/js/`));
    assert.equal(plain.headers.get('cache-control'), 'no-cache');
    const stale = await t.client().raw('GET', '/v/4.0.0-oldbuild/js/views/closet.js');
    assert.equal(stale.status, 200);
    assert.match(stale.text, new RegExp(`/v/${seg}/js/`));
  });

  test('stylesheets and the bundled UI toolkit are served from the versioned path too', async () => {
    const css = await t.client().raw('GET', `/v/${seg}/css/app.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /css/);
    assert.equal((await t.client().raw('GET', `/v/${seg}/vendor/ui.js`)).status, 200);
  });

  test('cannot be used to read other files', async () => {
    for (const p of [`/v/${seg}/js/../../package.json`, `/v/${seg}/js/%2e%2e/%2e%2e/package.json`, `/v/${seg}/shared/../../server.js`, `/v/${seg}/js/%00.js`, `/v/${seg}/secrets/x.js`, `/v/${seg}/js/`, `/v/${seg}/js/nope.js`]) {
      const res = await t.client().raw('GET', p, undefined, { accept: 'application/json' });
      assert.notEqual(res.status, 200, p);
      assert.doesNotMatch(res.text, /"name": "modaward"|require\(/, p);
    }
  });

  test('the service worker precaches this build’s files', async () => {
    const sw = (await t.client().raw('GET', '/sw.js')).text;
    assert.match(sw, new RegExp(`'/v/${seg}/js/main\\.js'`));
    assert.match(sw, new RegExp(`'/v/${seg}/css/app\\.css'`));
    assert.match(sw, /const VERSION = 'mw-/);
  });

  test('a real release caches versioned files for a year; a development build never does', () => {
    const base = { publicDir: t.config.publicDir, sharedDir: t.config.sharedDir };
    const headers = {};
    const res = { setHeader: (k, v) => (headers[k] = v), send() {}, sendFile() {} };
    const next = () => assert.fail('should have been served');
    createAssets({ ...base, build: { id: '5.5.0+abc1234' } }).versioned({ path: '/v/5.5.0-abc1234/js/ui.js' }, res, next);
    assert.match(headers['Cache-Control'], /immutable/);
    createAssets({ ...base, build: { id: 'development' } }).versioned({ path: '/v/development/js/ui.js' }, res, next);
    assert.equal(headers['Cache-Control'], 'no-cache');
    // an address from an older build is answered with current files, so it must not be cached as permanent
    createAssets({ ...base, build: { id: '5.5.0+abc1234' } }).versioned({ path: '/v/5.4.0-old/js/ui.js' }, res, next);
    assert.equal(headers['Cache-Control'], 'no-cache');
    assert.equal(buildSegment('5.5.0+097345b'), '5.5.0-097345b');
  });
});
