import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';
import { parseCsv, mapFeed } from '../src/shop/feed.js';
import { createLinker } from '../src/shop/links.js';
import { assignRetailers, retailerPrefs } from '../src/shop/assign.js';
import { DEFAULT_PROFILE, mergeProfile } from '../src/shared/profile.js';
import { buildPool } from '../src/shop/pool.js';
import { affiliateUrl, searchUrl, retailerById, RETAILERS } from '../src/shop/retailers.js';

describe('links', () => {
  const linker = createLinker({ secret: 's'.repeat(32), affiliates: { hm: 'https://track.example/c?u={url}&sub={subid}' } });

  test('signed links verify; tampering with any field fails', () => {
    const url = searchUrl(retailerById('hm'), "men's navy chinos");
    const link = linker.link('hm', url, 'search');
    const q = Object.fromEntries(new URL('http://x' + link).searchParams);
    const ok = linker.verify(q);
    assert.ok(ok);
    assert.match(ok.destination, /^https:\/\/track\.example\/c\?u=https%3A%2F%2Fwww2\.hm\.com/);
    assert.equal(linker.verify({ ...q, u: 'https://evil.example/' }), null);
    assert.equal(linker.verify({ ...q, r: 'zara' }), null);
    assert.equal(linker.verify({ ...q, k: 'product' }), null);
    assert.equal(linker.verify({ ...q, s: 'x'.repeat(43) }), null);
    assert.equal(linker.verify({}), null);
  });

  test('a validly signed link to a foreign host is still refused for search links, and http is refused always', () => {
    const evil = linker.link('hm', 'https://evil.example/', 'search');
    assert.equal(linker.verify(Object.fromEntries(new URL('http://x' + evil).searchParams)), null);
    const insecure = linker.link('hm', 'http://www2.hm.com/x', 'search');
    assert.equal(linker.verify(Object.fromEntries(new URL('http://x' + insecure).searchParams)), null);
  });

  test('product links may use a network tracking domain because the signature vouches for them', () => {
    const l = linker.link('hm', 'https://click.network.example/abc', 'product');
    assert.ok(linker.verify(Object.fromEntries(new URL('http://x' + l).searchParams)));
  });

  test('affiliate wrapping only applies where configured', () => {
    assert.equal(affiliateUrl({}, 'hm', 'https://a.example/'), 'https://a.example/');
    assert.equal(affiliateUrl({ hm: 'no-placeholder' }, 'hm', 'https://a.example/'), 'https://a.example/');
  });

  test('every retailer produces a valid https search URL', () => {
    for (const r of RETAILERS) {
      const u = new URL(searchUrl(r, "men's navy chino pants"));
      assert.equal(u.protocol, 'https:');
      assert.ok(decodeURIComponent(u.search).includes('navy chino'), r.id);
    }
  });
});

describe('retailer assignment', () => {
  const piece = (type, category) => ({ id: type, type, category, source: 'spec' });
  const profile = (patch) => mergeProfile(DEFAULT_PROFILE, patch);

  test('mix mode uses at most two stores per look', () => {
    const pieces = [piece('shirt', 'top'), piece('trousers', 'bottom'), piece('trench', 'outerwear'), piece('loafers', 'shoes'), piece('belt', 'accessory')];
    const map = assignRetailers(pieces, profile({ department: 'men', style: { archetypes: { classic: 0.9 } } }), 'mix');
    assert.ok(new Set([...map.values()].map((r) => r.id)).size <= 2);
    assert.equal(map.size, 5);
  });

  test('single mode uses exactly one store that carries everything', () => {
    const pieces = [piece('tee', 'top'), piece('jeans', 'bottom'), piece('sneakers', 'shoes')];
    const map = assignRetailers(pieces, profile({ style: { archetypes: { casual: 0.9 } } }), 'single');
    assert.equal(new Set([...map.values()].map((r) => r.id)).size, 1);
  });

  test('chosen stores are respected, and avoided brands are never used', () => {
    const pieces = [piece('tee', 'top'), piece('jeans', 'bottom')];
    const chosen = assignRetailers(pieces, profile({ style: { stores: ['uniqlo', 'gap'] } }), 'mix');
    for (const r of chosen.values()) assert.ok(['uniqlo', 'gap'].includes(r.id));
    const avoid = assignRetailers(pieces, profile({ style: { brands: { avoid: ['Uniqlo', 'H&M', 'Gap', 'Old Navy', 'Target', 'ASOS'] } } }), 'mix');
    for (const r of avoid.values()) assert.ok(!['uniqlo', 'hm', 'gap', 'oldnavy', 'target', 'asos'].includes(r.id));
  });

  test('budget tier steers towards fitting retailers; sporty style towards Nike', () => {
    const value = assignRetailers([piece('tee', 'top')], profile({ budget: { tier: 'value', set: true, top: 25, bottom: 35, dress: 45, outerwear: 80, shoes: 50 } }), 'mix').get('tee');
    assert.equal(value.tier, 'value');
    const sporty = assignRetailers([piece('runners', 'shoes')], profile({ style: { archetypes: { sporty: 1 } } }), 'mix').get('runners');
    assert.equal(sporty.id, 'nike');
  });

  test('Nike cannot supply a dress, so single mode falls back to mixing for a look that needs one', () => {
    const pieces = [piece('dress', 'dress'), piece('runners', 'shoes')];
    const map = assignRetailers(pieces, profile({ style: { archetypes: { sporty: 1 }, stores: ['nike'] } }), 'single');
    assert.equal(map.size, 2);
    assert.notEqual(map.get('dress').id, undefined);
  });

  test('prefs expose the budget tier', () => {
    assert.equal(retailerPrefs(profile({})).tier, 2);
  });
});

describe('pool hard rules', () => {
  const ref = { minFeels: 10, maxFeels: 18 };
  const base = (style = {}, extra = {}) => mergeProfile(DEFAULT_PROFILE, { style: { archetypes: { casual: 0.9, street: 0.7, sporty: 0.6 }, ...style }, ...extra });

  test('"never" tags and avoided colours are absolute', () => {
    const pool = buildPool({ profile: base({ never: ['shorts', 'sleeveless', 'wool', 'leather', 'graphic'], avoidedColors: ['olive'] }), ref: { minFeels: 20, maxFeels: 30 }, occasion: 'casual', seed: 1 });
    assert.ok(pool.length > 50);
    for (const p of pool) {
      assert.notEqual(p.type, 'shorts');
      assert.notEqual(p.type, 'tank');
      assert.notEqual(p.colorName, 'olive');
      assert.ok(!/leather|wool|merino/.test(p.descriptor), p.descriptor);
      assert.notEqual(p.pattern, 'graphic');
    }
  });

  test('menswear excludes dresses and skirts; cold weather excludes sandals and shorts; hot excludes parkas', () => {
    const men = buildPool({ profile: base({}, { department: 'men' }), ref, occasion: 'casual', seed: 1 });
    assert.ok(!men.some((p) => ['dress', 'skirt', 'sundress', 'heels'].includes(p.type)));
    const cold = buildPool({ profile: base(), ref: { minFeels: -2, maxFeels: 5 }, occasion: 'casual', seed: 1 });
    assert.ok(!cold.some((p) => ['sandals', 'shorts', 'sundress'].includes(p.type)));
    const hot = buildPool({ profile: base(), ref: { minFeels: 24, maxFeels: 33 }, occasion: 'casual', seed: 1 });
    assert.ok(!hot.some((p) => ['parka', 'puffer', 'wool-coat'].includes(p.type)));
  });

  test('liked colours join the palette where realistic', () => {
    const pool = buildPool({ profile: base({ likedColors: ['mustard'] }), ref, occasion: 'casual', seed: 1 });
    assert.ok(pool.some((p) => p.colorName === 'mustard' && p.category === 'top'));
    assert.ok(!pool.some((p) => p.colorName === 'mustard' && p.category === 'shoes'));
  });

  test('occasion formality limits the pool: no joggers for formal events', () => {
    const pool = buildPool({ profile: base(), ref, occasion: 'formal', seed: 1 });
    assert.ok(!pool.some((p) => ['joggers', 'hoodie', 'sneakers'].includes(p.type)));
  });
});

describe('shop API', () => {
  let t;
  before(async () => {
    t = await startTestServer({ env: { FREE_SHOP_LOOKS: '6' } });
  });
  after(() => t.close());

  async function user({ pro = false, profile = {}, closet = true } = {}) {
    const c = t.client();
    const reg = await registerUser(c);
    await c.patch('/api/profile', { location: NYC, department: 'men', style: { archetypes: { classic: 0.9, minimal: 0.7 }, quizDone: true }, lifestyle: { occasions: ['work', 'weekend'] }, ...profile });
    if (closet) await c.post('/api/garments/starter', { department: 'men' });
    if (pro) t.deps.repos.users.setPlan(reg.user.id, { plan: 'pro', status: 'active' });
    return { c, reg };
  }

  test('requires a session and a location', async () => {
    assert.equal((await t.client().post('/api/shop/looks', {})).status, 401);
    const c = t.client();
    await registerUser(c);
    assert.equal((await c.post('/api/shop/looks', {})).status, 409);
  });

  test('free users see 6 looks and an honest count of what is locked; pro sees the full feed', async () => {
    const free = await user();
    const f = (await free.c.post('/api/shop/looks', { limit: 18 })).json;
    assert.equal(f.looks.length, 6);
    assert.ok(f.locked >= 1);
    const pro = await user({ pro: true });
    const p = (await pro.c.post('/api/shop/looks', { limit: 24 })).json;
    assert.ok(p.looks.length >= 12, `pro got ${p.looks.length}`);
    assert.equal(p.locked, 0);
  });

  test('looks are complete, weather-aware, explained and have signed outbound links', async () => {
    const { c } = await user({ pro: true });
    const { looks, reference } = (await c.post('/api/shop/looks', { limit: 12 })).json;
    assert.ok(reference.range);
    for (const look of looks) {
      assert.ok(look.title && look.reasons.length >= 2);
      const slots = look.pieces.map((p) => p.slot);
      assert.ok(slots.includes('shoes'));
      assert.ok(slots.includes('top') || slots.includes('dress'));
      for (const piece of look.pieces.filter((p) => p.source !== 'owned')) {
        assert.ok(piece.retailer?.name);
        assert.match(piece.link, /^\/go\?r=[a-z]+&k=search&u=https%3A%2F%2F/);
      }
      assert.ok(look.storeCount <= 2);
    }
    assert.ok(looks.some((l) => l.kind === 'new'));
    assert.ok(looks.some((l) => l.kind === 'owned'));
    // never women's items for a menswear profile
    assert.ok(!looks.some((l) => l.pieces.some((p) => ['skirt', 'dress', 'heels', 'blouse'].includes(p.type))));
  });

  test('identical requests are served from cache (no second CPU-heavy build); any change recomputes', async () => {
    const { c } = await user({ pro: true });
    const before = t.deps.shop.stats.computed;
    await c.post('/api/shop/looks', { seed: 'memo', limit: 8 });
    await c.post('/api/shop/looks', { seed: 'memo', limit: 8 });
    assert.equal(t.deps.shop.stats.computed, before + 1);
    await c.post('/api/garments', { type: 'tee', color: '#ffffff' });
    await c.post('/api/shop/looks', { seed: 'memo', limit: 8 });
    assert.equal(t.deps.shop.stats.computed, before + 2);
  });

  test('the same seed returns the same looks; a new seed returns different ones', async () => {
    const { c } = await user({ pro: true });
    const ids = async (seed) => (await c.post('/api/shop/looks', { seed, limit: 10 })).json.looks.map((l) => l.id);
    const a = await ids('s1');
    assert.deepEqual(a, await ids('s1'));
    const b = await ids('s2');
    assert.notDeepEqual(a, b);
  });

  test('single-store mode puts every new piece at one retailer', async () => {
    const { c } = await user({ pro: true });
    const { looks } = (await c.post('/api/shop/looks', { storeMode: 'single', kind: 'new', limit: 8 })).json;
    for (const l of looks) assert.ok(l.storeCount <= 1, l.title);
  });

  test('"never" rules from the profile are honoured end to end', async () => {
    const { c } = await user({ pro: true, profile: { style: { archetypes: { casual: 0.9 }, never: ['shorts', 'heels'], avoidedColors: ['olive'] } } });
    const { looks } = (await c.post('/api/shop/looks', { limit: 20 })).json;
    for (const l of looks) for (const p of l.pieces.filter((x) => x.source !== 'owned')) {
      assert.notEqual(p.type, 'shorts');
      assert.notEqual(p.colorName, 'olive');
    }
  });

  test('loving looks teaches the model; disliking a look hides it forever', async () => {
    const { c, reg } = await user({ pro: true });
    const { looks } = (await c.post('/api/shop/looks', { seed: 'f', limit: 10 })).json;
    const first = looks[0];
    assert.equal((await c.post('/api/shop/feedback', { lookId: first.id, signal: 'love' })).json.learned, 1);
    assert.equal((await c.post('/api/shop/feedback', { lookId: looks[1].id, signal: 'dislike' })).status, 200);
    assert.equal((await c.post('/api/shop/feedback', { lookId: looks[2].id, signal: 'dislike', pieceIndex: 0 })).status, 200);
    assert.equal(t.deps.repos.profiles.getTaste(reg.user.id).n, 3);
    const again = (await c.post('/api/shop/looks', { seed: 'f', limit: 10 })).json.looks;
    assert.ok(!again.some((l) => l.key === looks[1].key));
    assert.equal((await c.post('/api/shop/feedback', { lookId: 'nope', signal: 'love' })).status, 404);
  });

  test("a look from one account cannot be rated by another", async () => {
    const a = await user({ pro: true });
    const b = await user({ pro: true });
    const look = (await a.c.post('/api/shop/looks', { limit: 4 })).json.looks[0];
    assert.equal((await b.c.post('/api/shop/feedback', { lookId: look.id, signal: 'love' })).status, 404);
    assert.equal((await b.c.post('/api/shop/saved', { lookId: look.id })).status, 404);
  });

  test('saving looks: list, remove, and the free-plan cap', async () => {
    const { c } = await user({ pro: false });
    const { looks } = (await c.post('/api/shop/looks', { limit: 6 })).json;
    for (let i = 0; i < 6; i++) assert.equal((await c.post('/api/shop/saved', { lookId: looks[i].id })).status, 201);
    const saved = (await c.get('/api/shop/saved')).json.saved;
    assert.equal(saved.length, 6);
    assert.equal((await c.del(`/api/shop/saved/${saved[0].id}`)).status, 200);
    assert.equal((await c.del(`/api/shop/saved/${saved[0].id}`)).status, 404);
    // fill to the cap, then the next save asks for an upgrade
    const more = (await c.post('/api/shop/looks', { seed: 'more', limit: 6 })).json.looks;
    let status;
    for (const l of more.concat(looks)) {
      status = (await c.post('/api/shop/saved', { lookId: l.id })).status;
      if (status !== 201) break;
    }
    assert.equal(status, 402);
  });

  test('closet gaps explain themselves and suggest pieces', async () => {
    const { c } = await user({ closet: false });
    await c.post('/api/garments', { type: 'tee', color: '#ffffff' });
    await c.post('/api/garments', { type: 'jeans', color: '#2b3a55' });
    const { gaps } = (await c.post('/api/shop/gaps', {})).json;
    assert.ok(gaps.length >= 2);
    assert.ok(gaps.every((g) => g.why.length > 10 && g.pieces.length > 0));
    assert.ok(gaps.some((g) => g.id.startsWith('second-shoes')));
  });

  test('retailer list is available for the profile UI', async () => {
    const { c } = await user();
    const r = (await c.get('/api/shop/retailers')).json.retailers;
    assert.ok(r.length >= 10 && r.every((x) => x.id && x.name));
  });

  describe('/go redirect', () => {
    test('valid signed link redirects and logs the click; invalid links are refused', async () => {
      const { c } = await user({ pro: true });
      const look = (await c.post('/api/shop/looks', { kind: 'new', limit: 3 })).json.looks[0];
      const link = look.pieces.find((p) => p.link).link;
      const res = await c.get(link);
      assert.equal(res.status, 302);
      assert.match(res.headers.get('location'), /^https:\/\//);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(t.deps.db.get('SELECT COUNT(*) AS n FROM click_events').n >= 1, true);

      const tampered = link.replace(/u=[^&]+/, 'u=' + encodeURIComponent('https://evil.example/'));
      assert.equal((await c.get(tampered)).status, 400);
      assert.equal((await t.client().get('/go?r=hm&k=search&u=https%3A%2F%2Fevil.example&s=abc')).status, 400);
      assert.equal((await t.client().get('/go')).status, 400);
    });
  });

  describe('real catalogue products', () => {
    const csv = [
      'sku,title,link,image_link,price,color,gender,category,brand',
      ...['Slim Fit Cotton T-Shirt|Navy|Tops', 'Oxford Button Down Shirt|Light Blue|Shirts', 'Crewneck Merino Sweater|Cream|Knitwear', 'Slim Chino Pants|Khaki|Pants', 'Straight Leg Jeans|Dark Wash|Jeans', 'Tailored Dress Pants|Charcoal|Pants', 'Leather Penny Loafers|Brown|Shoes', 'Low Top Leather Sneakers|White|Shoes', 'Classic Trench Coat|Camel|Outerwear', 'Wool Blend Overcoat|Charcoal|Outerwear', 'Tailored Blazer|Navy|Outerwear']
        .map((s, i) => { const [title, color, cat] = s.split('|'); return `P${i},${title},https://shop.example/p/${i},https://img.example/${i}.jpg,$${30 + i * 9}.00,${color},Men,Men > ${cat},Acme`; })
    ].join('\n');

    test('imported products appear as real cards with photo, price and a signed link', async () => {
      const { c } = await user({ pro: true, profile: { style: { archetypes: { classic: 0.9 }, stores: ['bananarepublic'] } } });
      const { products } = mapFeed(parseCsv(csv), { retailer: 'bananarepublic' });
      assert.equal(products.length, 11);
      t.deps.catalog.upsert(products);
      const res = (await c.post('/api/shop/looks', { kind: 'new', limit: 8, seed: 'p' })).json;
      assert.equal(res.usingProducts, true);
      const cards = res.looks.flatMap((l) => l.pieces).filter((p) => p.source === 'product');
      assert.ok(cards.length > 0, 'expected at least one real product card');
      for (const card of cards) {
        assert.match(card.product.image, /^https:\/\/img\.example\//);
        assert.ok(card.product.priceCents > 0);
        assert.match(card.link, /k=product/);
        assert.equal(card.retailer.id, 'bananarepublic');
      }
      const priced = res.looks.find((l) => l.totalCents);
      if (priced) assert.ok(priced.totalCents > 0);
    });
  });
});
