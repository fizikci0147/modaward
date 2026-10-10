import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser } from './helpers.js';

const FEED = `id,title,link,image_link,price,color,gender,product_type
a1,Slim Navy Chinos,https://www.zara.com/p/a1,https://static.zara.net/a1.jpg,49.90 USD,navy,men,Pants > Chinos
a2,White Linen Shirt,https://www.zara.com/p/a2,https://static.zara.net/a2.jpg,39.00,white,women,Shirts
a3,Mystery Object,https://www.zara.com/p/a3,https://static.zara.net/a3.jpg,10,navy,men,Misc
a4,Black Leather Boots,http://www.zara.com/p/a4,https://static.zara.net/a4.jpg,99,black,men,Boots`;

describe('admin products', () => {
  let t;
  let admin;
  before(async () => {
    t = await startTestServer({ env: { ADMIN_EMAILS: 'boss@example.com' } });
    admin = t.client();
    await registerUser(admin, { email: 'boss@example.com' });
  });
  after(() => t.close());

  test('admins only', async () => {
    const c = t.client();
    await registerUser(c);
    for (const [m, u] of [['get', '/api/admin/products'], ['post', '/api/admin/products'], ['post', '/api/admin/products/import']]) {
      assert.equal((await c[m](u, {})).status, 403, u);
    }
    assert.equal((await t.client().get('/api/admin/products')).status, 401);
  });

  test('add a hand-picked product, find it, mark it out of stock, delete it', async () => {
    const body = { retailer: 'zara', title: 'Camel Wool Coat', brand: 'Zara', url: 'https://www.zara.com/us/en/coat-p1.html', imageUrl: 'https://static.zara.net/coat.jpg', price: '$129.00', type: 'wool-coat', color: 'camel', gender: 'women' };
    const made = await admin.post('/api/admin/products', body);
    assert.equal(made.status, 201);
    const id = made.json.id;
    assert.match(id, /^zara:m-[0-9a-f]{14}$/);
    // same link again updates rather than duplicating
    assert.equal((await admin.post('/api/admin/products', { ...body, title: 'Camel Wool Coat v2' })).status, 201);

    const list = (await admin.get('/api/admin/products?retailer=zara&q=camel')).json;
    assert.equal(list.total, 1);
    assert.equal(list.products[0].title, 'Camel Wool Coat v2');
    assert.equal(list.products[0].priceCents, 12900);
    assert.equal(list.products[0].category, 'outerwear');
    assert.equal(list.products[0].color, 'camel');
    assert.ok(list.retailers.includes('zara') && list.colors.includes('camel') && list.types.length > 10);

    assert.equal((await admin.patch(`/api/admin/products/${encodeURIComponent(id)}`, { inStock: false })).status, 200);
    assert.equal((await admin.get('/api/admin/products?retailer=zara')).json.products[0].inStock, false);
    assert.equal((await admin.del(`/api/admin/products/${encodeURIComponent(id)}`)).status, 200);
    assert.equal((await admin.del(`/api/admin/products/${encodeURIComponent(id)}`)).status, 404);
  });

  test('rejects unsafe or malformed products', async () => {
    const ok = { retailer: 'zara', title: 'Navy Tee', url: 'https://www.zara.com/p/1', imageUrl: 'https://static.zara.net/1.jpg', type: 'tee', color: 'navy' };
    for (const bad of [{ url: 'http://www.zara.com/p/1' }, { url: 'javascript:alert(1)' }, { imageUrl: 'data:image/png;base64,AAAA' }, { imageUrl: 'https://user:pw@x.com/a.jpg' }, { retailer: 'nope' }, { type: 'spaceship' }, { color: 'plaid-ish' }, { title: '' }]) {
      const r = await admin.post('/api/admin/products', { ...ok, ...bad });
      assert.equal(r.status, 400, JSON.stringify(bad));
    }
    assert.equal((await admin.post('/api/admin/products', ok)).status, 201);
    assert.equal((await admin.del('/api/admin/products/not-an-id')).status, 404);
  });

  test('feed import: preview first, then import; bad rows are explained', async () => {
    const before = (await admin.get('/api/admin/products?retailer=zara')).json.total;
    const preview = (await admin.post('/api/admin/products/import', { retailer: 'zara', text: FEED })).json;
    assert.equal(preview.dryRun, true);
    assert.equal(preview.rows, 4);
    assert.equal(preview.usable, 3, 'the http:// product link is upgraded to https');
    assert.equal(preview.skipped, 1);
    assert.match(preview.reasons[0].reason, /could not tell what kind of garment/);
    assert.ok(preview.byType.some((x) => x.type === 'chinos'));
    assert.equal(preview.sample[0].title, 'Slim Navy Chinos');
    assert.equal((await admin.get('/api/admin/products?retailer=zara')).json.total, before, 'a preview writes nothing');

    const done = (await admin.post('/api/admin/products/import', { retailer: 'zara', text: FEED, dryRun: false })).json;
    assert.equal(done.inserted, 3);
    assert.equal((await admin.get('/api/admin/products?retailer=zara')).json.total, before + 3);
    const again = (await admin.post('/api/admin/products/import', { retailer: 'zara', text: FEED, dryRun: false })).json;
    assert.equal(again.inserted, 0);
    assert.equal(again.updated, 3);
  });

  test('feed import: JSON, and clear errors for junk', async () => {
    const json = JSON.stringify({ products: [{ id: 'j1', name: 'Grey Wool Sweater', url: 'https://www.hm.com/j1', image: 'https://img.hm.com/j1.jpg', price: '29.99', color: 'grey', gender: 'men' }] });
    const r = await admin.post('/api/admin/products/import', { retailer: 'hm', text: json });
    assert.equal(r.status, 200);
    assert.equal(r.json.usable, 1);
    assert.equal((await admin.post('/api/admin/products/import', { retailer: 'hm', text: '{"broken": ', format: 'json' })).status, 400);
    assert.equal((await admin.post('/api/admin/products/import', { retailer: 'hm', text: 'just one line of header' })).status, 400);
    assert.equal((await admin.post('/api/admin/products/import', { retailer: 'nope', text: FEED })).status, 400);
  });

  test('imported products flow into the shop’s catalogue counts', async () => {
    const m = (await admin.get('/api/admin/metrics')).json;
    assert.ok(m.catalogue.products >= 3);
  });
});
