import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

// The /cities city maps (and the /phillyproject address that preceded them) were taken out for now.
// The work is kept on the cities-5.19 branch. These tests make sure nothing of it is still served and that
// the looser security policy the maps needed is gone from the whole site.
describe('the /cities maps are not part of this version', () => {
  let t;
  before(async () => {
    t = await startTestServer();
  });
  after(() => t.close());

  test('their files are not served', async () => {
    for (const path of ['/cities/philadelphia/meta.json', '/cities/nyc/meta.json', '/cities/nyc/landmarks.json', '/cities/img/logo.png', '/phillyproject/meta.json']) {
      const res = await t.client().raw('GET', path);
      assert.equal(res.status, 404, path);
    }
  });

  test('their addresses show the ordinary app, not a map, and every page keeps the strict policy', async () => {
    for (const path of ['/cities', '/cities/', '/cities/philadelphia/', '/phillyproject', '/phillyproject/']) {
      const res = await t.client().raw('GET', path, undefined, { accept: 'text/html' });
      assert.equal(res.status, 200, path);
      assert.match(res.text, /<title>ModaWard · /, `${path} is the app shell`);
      assert.doesNotMatch(res.text, /mapillary|Philadelphia|buildings by year/i, path);
      const csp = res.headers.get('content-security-policy');
      assert.match(csp, /script-src 'self';/, path);
      assert.doesNotMatch(csp, /unsafe-inline|mapillary|fbcdn|googleapis/, `${path}: no loosened policy`);
      assert.equal(res.headers.get('x-robots-tag'), null, path);
    }
  });

  test('nothing from the maps is left in the app folder or the config', async () => {
    const { default: fs } = await import('node:fs');
    const { default: path } = await import('node:path');
    assert.equal(fs.existsSync(path.join(t.config.publicDir, '..', 'sites')), false);
    assert.equal('sitesDir' in t.config, false);
    const pkg = fs.readFileSync(path.join(t.config.publicDir, '..', 'scripts', 'package.mjs'), 'utf8');
    assert.doesNotMatch(pkg, /'sites'/);
  });
});
