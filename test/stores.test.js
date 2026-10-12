import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';
import { RETAILERS, retailerById, searchUrl, customRetailer } from '../src/shop/retailers.js';
import { REGIONS, REGION_CODES, shopRegion } from '../src/shop/regions.js';
import { assignRetailers, eligibleRetailers, retailerPrefs } from '../src/shop/assign.js';
import { checkStoreInput } from '../src/shop/custom-stores.js';
import { DEFAULT_PROFILE, mergeProfile } from '../src/shared/profile.js';

const profile = (patch) => mergeProfile(DEFAULT_PROFILE, patch);
const piece = (type, category) => ({ id: type, type, category, source: 'spec' });

describe('the store database', () => {
  test('is large, every store is well formed, and no website is listed twice', () => {
    assert.ok(RETAILERS.length >= 500, `${RETAILERS.length} stores`);
    const ids = new Set();
    const domains = new Set();
    for (const r of RETAILERS) {
      assert.match(r.id, /^[a-z0-9]+$/, r.id);
      assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
      assert.ok(!domains.has(r.domain), `duplicate website ${r.domain}`);
      ids.add(r.id);
      domains.add(r.domain);
      assert.match(r.domain, /^[a-z0-9.-]+\.[a-z]{2,}$/, r.id);
      assert.ok(['value', 'mid', 'premium'].includes(r.tier), r.id);
      assert.ok(r.departments.length && r.carries.length, r.id);
      assert.ok(r.regions.every((c) => c === '*' || REGIONS[c]), `${r.id}: unknown region`);
      assert.ok(r.core.every((c) => REGIONS[c]), `${r.id}: unknown default region`);
    }
  });

  test('every region has a starter set that can dress a whole look', () => {
    for (const code of REGION_CODES) {
      const core = RETAILERS.filter((r) => r.core.includes(code));
      assert.ok(core.length >= 6, `${code}: only ${core.length} starter stores`);
      for (const cat of ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory']) assert.ok(core.some((r) => r.carries.includes(cat)), `${code} has nobody selling ${cat}`);
    }
  });

  test('the United States starter set is exactly the original fourteen, so nothing changes for existing people', () => {
    const us = RETAILERS.filter((r) => r.core.includes('US')).map((r) => r.id).sort();
    assert.deepEqual(us, ['asos', 'bananarepublic', 'everlane', 'gap', 'hm', 'jcrew', 'madewell', 'mango', 'nike', 'nordstrom', 'oldnavy', 'target', 'uniqlo', 'zara']);
  });

  test('links use a store’s own search page where we know it, and a site search otherwise', () => {
    assert.match(searchUrl(retailerById('zara'), 'blue shirt', 'US'), /^https:\/\/www\.zara\.com\/us\/en\/search\?searchTerm=blue%20shirt/);
    assert.match(searchUrl(retailerById('zara'), 'blue shirt', 'GB'), /^https:\/\/www\.google\.com\/search\?q=blue%20shirt%20site%3Azara\.com/);
    assert.equal(searchUrl(retailerById('amazonuk'), 'blue shirt', 'GB'), 'https://www.amazon.co.uk/s?k=blue%20shirt');
    for (const r of RETAILERS) for (const region of ['US', 'DE', 'TR']) assert.equal(new URL(searchUrl(r, 'navy chinos', region)).protocol, 'https:', r.id);
  });

  test('the region comes from the person’s choice, else their currency and language', () => {
    assert.equal(shopRegion({ shopRegion: 'FR' }), 'FR');
    assert.equal(shopRegion({ currency: 'GBP' }), 'GB');
    assert.equal(shopRegion({ currency: 'EUR', locale: 'es' }), 'ES');
    assert.equal(shopRegion({ currency: 'EUR' }), 'DE');
    assert.equal(shopRegion({ currency: 'TRY', locale: 'tr' }), 'TR');
    assert.equal(shopRegion({ currency: 'JPY' }), 'US');
    assert.equal(shopRegion({ shopRegion: 'ZZ', currency: 'AUD' }), 'AU');
  });
});

describe('choosing stores', () => {
  const look = [piece('shirt', 'top'), piece('trousers', 'bottom'), piece('trench', 'outerwear'), piece('loafers', 'shoes')];

  test('with no stores chosen, people in different regions are sent to stores that ship to them', () => {
    const us = new Set(eligibleRetailers(retailerPrefs(profile({ currency: 'USD' }))).map((r) => r.id));
    const de = eligibleRetailers(retailerPrefs(profile({ currency: 'EUR', locale: 'de' })));
    const tr = eligibleRetailers(retailerPrefs(profile({ currency: 'TRY', locale: 'tr' })));
    assert.ok(us.has('target') && !us.has('trendyol'));
    assert.ok(de.some((r) => r.id === 'zalandode') && !de.some((r) => r.id === 'target'));
    assert.ok(tr.some((r) => r.id === 'trendyol') && !tr.some((r) => r.id === 'nordstrom'));
  });

  test('a person’s own picks come from the whole database, in any region', () => {
    const p = profile({ currency: 'USD', style: { stores: ['gucci', 'zalandode', 'trendyol'] } });
    const ids = eligibleRetailers(retailerPrefs(p)).map((r) => r.id).sort();
    assert.deepEqual(ids, ['gucci', 'trendyol', 'zalandode']);
    const map = assignRetailers(look, p, 'mix');
    for (const r of map.values()) assert.ok(['gucci', 'trendyol', 'zalandode'].includes(r.id), r.id);
  });

  test('a store the person added is used for their looks, and only when it is chosen', () => {
    const mine = customRetailer({ id: 7, name: 'Corner Boutique', domain: 'cornerboutique.example.com', search: null });
    const chosen = profile({ style: { stores: [mine.id] } });
    chosen.customStores = [mine];
    const map = assignRetailers(look, chosen, 'mix');
    assert.equal(map.size, look.length);
    for (const r of map.values()) assert.equal(r.id, 'c_7');
    // added but not chosen: it stays out of the way
    const notChosen = profile({});
    notChosen.customStores = [mine];
    for (const r of assignRetailers(look, notChosen, 'mix').values()) assert.notEqual(r.id, 'c_7');
  });

  test('a brand the person avoids is never offered, even if it is in their region’s starter set', () => {
    const p = profile({ style: { brands: { avoid: ['Zara', 'H&M'] } } });
    for (const r of assignRetailers(look, p, 'mix').values()) assert.ok(!['zara', 'hm'].includes(r.id));
  });
});

describe('adding a store: checking the address', () => {
  test('accepts ordinary shop addresses and keeps just the website', () => {
    assert.deepEqual(checkStoreInput({ name: ' My  Shop ', url: 'https://www.Store.co.uk/some/page?x=1' }), { name: 'My Shop', domain: 'store.co.uk', search: null });
    assert.equal(checkStoreInput({ name: 'x', url: 'esnaf.com.tr/ara' }).domain, 'esnaf.com.tr');
    assert.equal(checkStoreInput({ name: 'x', url: 'http://shop.example-store.de' }).domain, 'shop.example-store.de');
  });

  test('refuses anything that is not a plain public website', () => {
    for (const url of ['localhost', '127.0.0.1', 'http://192.168.1.1/x', '10.0.0.5', 'user:pw@evil.com', 'https://evil.com:8080', 'shop.local', 'x.internal', 'javascript:alert(1)', 'a b.com', 'https://[::1]/', 'store', 'ftp://x.com', 'https://x..com', 'https://-a.com', '']) {
      assert.throws(() => checkStoreInput({ name: 'n', url }), /address|website|name|port|password|public/i, `accepted ${JSON.stringify(url)}`);
    }
    assert.throws(() => checkStoreInput({ name: '   ', url: 'store.com' }), /name/);
    assert.throws(() => checkStoreInput({ name: 'x'.repeat(41), url: 'store.com' }), /40/);
  });

  test('a search link must be on the same website and say where the words go', () => {
    assert.equal(checkStoreInput({ name: 'S', url: 'store.com', search: 'https://store.com/search?q={q}' }).search, 'https://store.com/search?q={q}');
    assert.equal(checkStoreInput({ name: 'S', url: 'store.com', search: 'https://shop.store.com/s/{q}' }).search, 'https://shop.store.com/s/{q}');
    for (const search of ['https://other.com/s?q={q}', 'https://store.com/s', 'https://store.com.evil.com/s?q={q}', 'http://127.0.0.1/s?q={q}']) {
      assert.throws(() => checkStoreInput({ name: 'S', url: 'store.com', search }), /search link|same website|address|public/i, search);
    }
  });
});

describe('stores through the API', () => {
  const servers = [];
  after(() => Promise.all(servers.map((s) => s.close())));
  const start = async () => {
    const t = await startTestServer({ env: { PRICING: 'free' } });
    servers.push(t);
    return t;
  };
  const follow = async (t, link, cookie) => (await fetch(t.base + link, { redirect: 'manual', headers: cookie ? { cookie } : {} }));

  test('the picker gets the whole database, the regions, and the person’s own stores', async () => {
    const t = await start();
    const c = t.client();
    await registerUser(c);
    await c.patch('/api/profile', { currency: 'GBP' });
    const d = (await c.get('/api/shop/stores')).json;
    assert.equal(d.region, 'GB');
    assert.ok(d.stores.length >= 500);
    assert.equal(d.regions.length, REGION_CODES.length);
    assert.deepEqual(d.custom, []);
    assert.equal((await t.client().get('/api/shop/stores')).status, 401);
  });

  test('adding a store chooses it, shows it, and its links go to that store', async () => {
    const t = await start();
    const c = t.client();
    await registerUser(c);
    await c.patch('/api/profile', { location: NYC, department: 'women', style: { stores: ['zara'] } });
    const add = await c.post('/api/shop/stores', { name: 'Corner Boutique', url: 'https://www.cornerboutique.example.com/shop' });
    assert.equal(add.status, 201, add.text);
    assert.equal(add.json.store.name, 'Corner Boutique');
    assert.equal(add.json.store.domain, 'cornerboutique.example.com');
    const id = add.json.store.id;
    assert.match(id, /^c_\d+$/);
    assert.ok(add.json.stores.includes(id) && add.json.stores.includes('zara'), 'chosen alongside what they had');
    assert.equal((await c.get('/api/profile')).json.profile.style.stores.includes(id), true);
    assert.equal((await c.get('/api/shop/stores')).json.custom.length, 1);

    // choose only that store: every new piece in the shop now links to it
    await c.patch('/api/profile', { style: { stores: [id] } });
    const looks = (await c.post('/api/shop/looks', { curate: false, limit: 6 })).json.looks;
    const cards = looks.flatMap((l) => l.pieces).filter((p) => p.source === 'spec');
    assert.ok(cards.length > 0);
    for (const p of cards) {
      assert.equal(p.retailer.id, id);
      assert.equal(p.retailer.name, 'Corner Boutique');
      const res = await follow(t, p.link);
      assert.equal(res.status, 302);
      const dest = new URL(res.headers.get('location'));
      assert.equal(dest.hostname, 'www.google.com');
      assert.match(decodeURIComponent(dest.search), /site:cornerboutique\.example\.com/);
    }
  });

  test('a search link the person gave is used', async () => {
    const t = await start();
    const c = t.client();
    await registerUser(c);
    await c.patch('/api/profile', { location: NYC, department: 'women' });
    const add = await c.post('/api/shop/stores', { name: 'Butik', url: 'butik.example.com', search: 'https://butik.example.com/ara?kelime={q}' });
    assert.equal(add.status, 201, add.text);
    await c.patch('/api/profile', { style: { stores: [add.json.store.id] } });
    const card = (await c.post('/api/shop/looks', { curate: false, limit: 4 })).json.looks.flatMap((l) => l.pieces).find((p) => p.source === 'spec');
    const res = await follow(t, card.link);
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /^https:\/\/butik\.example\.com\/ara\?kelime=/);
  });

  test('bad addresses, a store we already have, duplicates and too many are refused', async () => {
    const t = await start();
    const c = t.client();
    await registerUser(c);
    assert.equal((await c.post('/api/shop/stores', { name: 'Evil', url: 'http://127.0.0.1/x' })).status, 400);
    assert.equal((await c.post('/api/shop/stores', { name: 'Evil', url: 'https://user:pw@evil.com' })).status, 400);
    assert.equal((await c.post('/api/shop/stores', { name: '', url: 'store.com' })).status, 400);
    const known = await c.post('/api/shop/stores', { name: 'My Zara', url: 'www.zara.com' });
    assert.equal(known.status, 409);
    assert.match(known.json.error.message, /Zara is already in our list/);
    assert.equal((await c.post('/api/shop/stores', { name: 'A', url: 'a-shop.example.com' })).status, 201);
    assert.equal((await c.post('/api/shop/stores', { name: 'A again', url: 'https://www.a-shop.example.com/x' })).status, 409);
    for (let i = 0; i < 24; i++) assert.equal((await c.post('/api/shop/stores', { name: `S${i}`, url: `s${i}.example.com` })).status, 201);
    const over = await c.post('/api/shop/stores', { name: 'One more', url: 'onemore.example.com' });
    assert.equal(over.status, 400);
    assert.match(over.json.error.message, /up to 25/);
  });

  test('stores are private: nobody else can choose, list or remove yours, and removing one drops it from the profile', async () => {
    const t = await start();
    const a = t.client();
    const b = t.client();
    await registerUser(a);
    await registerUser(b);
    const id = (await a.post('/api/shop/stores', { name: 'Mine', url: 'mine.example.com' })).json.store.id;
    assert.deepEqual((await b.get('/api/shop/stores')).json.custom, []);
    assert.equal((await b.patch('/api/profile', { style: { stores: [id] } })).status, 400, 'someone else’s store cannot be chosen');
    assert.equal((await b.del(`/api/shop/stores/${id}`)).status, 404);
    assert.equal((await a.patch('/api/profile', { style: { stores: ['no-such-store'] } })).status, 400);
    assert.equal((await a.patch('/api/profile', { style: { stores: ['gucci', id] } })).status, 200);

    const link = (await a.post('/api/shop/stores', { name: 'Gone', url: 'gone.example.com' })).json;
    const del = await a.del(`/api/shop/stores/${id}`);
    assert.equal(del.status, 200);
    assert.ok(!del.json.stores.includes(id));
    assert.ok(!(await a.get('/api/profile')).json.profile.style.stores.includes(id));
    assert.ok(link.store);
  });

  test('links to a store that was removed stop working, and a link cannot be pointed at another site', async () => {
    const t = await start();
    const c = t.client();
    await registerUser(c);
    await c.patch('/api/profile', { location: NYC, department: 'women' });
    const id = (await c.post('/api/shop/stores', { name: 'Temp', url: 'temp.example.com' })).json.store.id;
    await c.patch('/api/profile', { style: { stores: [id] } });
    const card = (await c.post('/api/shop/looks', { curate: false, limit: 4 })).json.looks.flatMap((l) => l.pieces).find((p) => p.source === 'spec');
    assert.equal((await follow(t, card.link)).status, 302);
    const tampered = card.link.replace(/u=[^&]+/, `u=${encodeURIComponent('https://evil.example/')}`);
    assert.equal((await follow(t, tampered)).status, 400);
    await c.del(`/api/shop/stores/${id}`);
    assert.equal((await follow(t, card.link)).status, 400);
  });

  test('added stores are in the data export', async () => {
    const t = await start();
    const c = t.client();
    await registerUser(c);
    await c.post('/api/shop/stores', { name: 'Exported', url: 'exported.example.com' });
    const data = (await c.get('/api/account/export')).json;
    assert.deepEqual(data.addedStores.map((s) => s.domain), ['exported.example.com']);
  });
});
