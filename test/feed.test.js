import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, detectDelimiter, inferType, inferColor, inferGender, inferPattern, parsePriceCents, mapFeed } from '../src/shop/feed.js';

describe('CSV parsing', () => {
  test('handles quotes, commas, escaped quotes and embedded newlines', () => {
    const rows = parseCsv('sku,title,desc\n1,"Shirt, slim","He said ""hi""\nsecond line"\n2,Tee,plain\n');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].title, 'Shirt, slim');
    assert.equal(rows[0].desc, 'He said "hi"\nsecond line');
    assert.equal(rows[1].sku, '2');
  });

  test('tolerates BOM, CRLF, tabs and missing trailing fields', () => {
    const text = '﻿SKU\tTitle\r\nA1\tBlue Tee\r\nA2\r\n';
    assert.equal(detectDelimiter(text), '\t');
    const rows = parseCsv(text, '\t');
    assert.equal(rows[0].title, 'Blue Tee');
    assert.equal(rows[1].title, '');
  });
});

describe('type inference', () => {
  const cases = [
    ['Men\'s Oxford Shirt in Blue', 'shirt'],
    ['Leather Oxford Shoes', 'dressshoes'],
    ['Slim Fit Cotton T-Shirt', 'tee'],
    ['Long Sleeve Henley', 'longsleeve'],
    ['Crewneck Merino Sweater', 'sweater'],
    ['Waterproof Rain Jacket', 'raincoat'],
    ['Classic Trench Coat', 'trench'],
    ['Wool Blend Overcoat', 'wool-coat'],
    ['Packable Puffer Jacket', 'puffer'],
    ['Straight Leg Jeans', 'jeans'],
    ['Slim Chino Pants', 'chinos'],
    ['Tailored Dress Pants', 'trousers'],
    ['Pleated Midi Skirt', 'skirt'],
    ['Smocked Sundress', 'sundress'],
    ['Wrap Dress', 'dress'],
    ['Sweater Dress', 'knitdress'],
    ['Low-Top Leather Sneakers', 'sneakers'],
    ['Chelsea Boot', 'chelsea'],
    ['Waterproof Winter Boots', 'waterproofboots'],
    ['Penny Loafers', 'loafers'],
    ['Ballet Flats', 'flats'],
    ['Denim Trucker Jacket', 'denimjacket'],
    ['Tailored Blazer', 'blazer'],
    ['Wool Beanie', 'beanie'],
    ['Cashmere Scarf', 'scarf'],
    ['Tech Fleece Jogger', 'joggers'],
    ['Polo Shirt', 'polo'],
    ['Classic Dress Shirt', 'shirt'],
    ['Black Dress Shoes', 'dressshoes'],
    ['Stretch Dress Pant', 'trousers']
  ];
  for (const [title, expected] of cases) {
    test(`"${title}" → ${expected}`, () => assert.equal(inferType(title), expected));
  }
  test('unknown items are not guessed', () => {
    assert.equal(inferType('Gift card'), null);
    assert.equal(inferType('Scented candle'), null);
  });
});

describe('colour, gender, pattern and price inference', () => {
  test('colours resolve to palette names, specific before generic', () => {
    assert.equal(inferColor('Navy Blue'), 'navy');
    assert.equal(inferColor('Heather Grey'), 'grey');
    assert.equal(inferColor('Light Wash'), 'light denim');
    assert.equal(inferColor('Off-White'), 'cream');
    assert.equal(inferColor('Hunter Green'), 'forest green');
    assert.equal(inferColor('Sparkly Unicorn'), null);
  });
  test('gender from department text', () => {
    assert.equal(inferGender("Women's Clothing > Dresses"), 'women');
    assert.equal(inferGender("Men's > Shirts"), 'men');
    assert.equal(inferGender('Apparel'), 'unisex');
  });
  test('patterns', () => {
    assert.equal(inferPattern('Striped Breton Tee'), 'striped');
    assert.equal(inferPattern('Floral Midi Dress'), 'floral');
    assert.equal(inferPattern('Plain Tee'), 'solid');
  });
  test('prices', () => {
    assert.equal(parsePriceCents('$29.99'), 2999);
    assert.equal(parsePriceCents('1,299.00 USD'), 129900);
    assert.equal(parsePriceCents('free'), null);
    assert.equal(parsePriceCents(''), null);
  });
});

describe('feed mapping', () => {
  // synthetic test data only; no real retailer products ship with the app
  const csv = [
    'sku,title,link,image_link,price,color,gender,category,brand,availability',
    'T1,Slim Fit Cotton T-Shirt,https://shop.example/p/t1,https://img.example/t1.jpg,$19.90,Navy Blue,Men,Men > Tops,Acme,in stock',
    'T2,Pleated Midi Skirt,https://shop.example/p/t2,https://img.example/t2.jpg,$49.00,Black,Women,Women > Skirts,Acme,in stock',
    'T3,Gift Card,https://shop.example/p/t3,https://img.example/t3.jpg,$25,Black,,,Acme,in stock',
    'T4,Chino Pants,http://shop.example/p/t4,http://img.example/t4.jpg,$59,Sparkly,Men,,Acme,in stock',
    'T5,Chino Pants,https://shop.example/p/t5,,$59,Khaki,Men,,Acme,in stock',
    'T6,Wool Coat,javascript:alert(1),https://img.example/t6.jpg,$199,Camel,Women,,Acme,in stock',
    'T1,Duplicate Tee,https://shop.example/p/t1b,https://img.example/t1b.jpg,$19.90,Navy,Men,,Acme,in stock',
    'T7,Rain Jacket,https://shop.example/p/t7,https://img.example/t7.jpg,$89,Olive,Men,,Acme,out of stock'
  ].join('\n');

  test('maps valid rows, upgrades http to https, rejects unsafe or unplaceable ones with reasons', () => {
    const { products, skipped } = mapFeed(parseCsv(csv), { retailer: 'testshop' });
    assert.deepEqual(products.map((p) => p.sku), ['T1', 'T2', 'T4', 'T7'].filter((s) => s !== 'T4'));
    const t1 = products[0];
    assert.equal(t1.type, 'tee');
    assert.equal(t1.color, 'navy');
    assert.equal(t1.gender, 'men');
    assert.equal(t1.priceCents, 1990);
    assert.equal(products[1].gender, 'women');
    assert.equal(products.find((p) => p.sku === 'T7').inStock, false);
    const reasons = skipped.map((s) => s.reason).join(' | ');
    assert.match(reasons, /could not tell what kind/);
    assert.match(reasons, /no valid https image/);
    assert.match(reasons, /no valid https product link/);
    assert.match(reasons, /duplicate sku/);
    assert.match(reasons, /unrecognised colour/);
    for (const p of products) {
      assert.ok(p.url.startsWith('https://'));
      assert.ok(p.imageUrl.startsWith('https://'));
    }
  });

  test('column mapping overrides for unusual feeds', () => {
    const rows = parseCsv('code,label,buy,pic,cost,hue\nX1,Wool Beanie,https://s.example/x1,https://i.example/x1.jpg,19,Grey');
    const { products } = mapFeed(rows, { retailer: 'r', map: { sku: 'code', title: 'label', url: 'buy', image: 'pic', price: 'cost', color: 'hue' } });
    assert.equal(products.length, 1);
    assert.equal(products[0].type, 'beanie');
    assert.equal(products[0].priceCents, 1900);
  });
});
