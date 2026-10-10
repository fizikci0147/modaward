/**
 * Product-feed ingestion. Affiliate networks (Rakuten, Impact, CJ, AWIN, ShareASale) all export
 * product data as CSV/XML/JSON with a title, price, image and tracking link. This module maps
 * those rows onto ModaWard's catalogue, inferring garment type, colour, gender and pattern
 * from free text, and rejecting rows it cannot place rather than guessing.
 */
import { PALETTE, nearestSwatch, isHex } from '../shared/color.js';
import { TYPES } from '../shared/taxonomy.js';

/** RFC 4180 CSV parser (quoted fields, escaped quotes, embedded newlines). */
export function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** Rows (lower-cased column names) from the text of a CSV/TSV or JSON feed. */
export function rowsFromText(text, { format = 'auto' } = {}) {
  const head = text.trimStart()[0];
  if (format === 'json' || (format === 'auto' && (head === '[' || head === '{'))) {
    const json = JSON.parse(text);
    const list = Array.isArray(json) ? json : json.products ?? json.items ?? [];
    return list.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v == null ? '' : String(v)])));
  }
  return parseCsv(text, detectDelimiter(text));
}

export function detectDelimiter(text) {
  const first = text.slice(0, 2000).split(/\r?\n/)[0] ?? '';
  const counts = { ',': 0, '\t': 0, '|': 0, ';': 0 };
  for (const ch of first) if (ch in counts) counts[ch] += 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Ordered by specificity: the first match wins. */
const TYPE_RULES = [
  [/sweater dress|knit dress/, 'knitdress'],
  [/jumpsuit|romper|playsuit/, 'jumpsuit'],
  [/cocktail dress|evening (dress|gown)|\bgown\b|formal dress/, 'eveningdress'],
  [/sundress|summer dress|sun dress/, 'sundress'],
  [/\bdress\b(?!\s*(pants?|shirts?|shoes?|socks?|trousers?|boots?|slacks|belts?|watch))/, 'dress'],
  [/rain ?(coat|jacket)|waterproof (jacket|shell)|rain shell/, 'raincoat'],
  [/trench/, 'trench'],
  [/parka/, 'parka'],
  [/puffer|down jacket|quilted jacket|padded jacket/, 'puffer'],
  [/wool (blend )?coat|overcoat|topcoat|peacoat|pea coat|car coat/, 'wool-coat'],
  [/blazer|sport ?coat|suit jacket/, 'blazer'],
  [/denim jacket|jean jacket|trucker jacket/, 'denimjacket'],
  [/bomber/, 'bomber'],
  [/fleece jacket|fleece full[- ]zip/, 'fleece'],
  [/\b(jacket|coat|windbreaker|shacket|anorak)\b/, 'lightjacket'],
  [/cardigan/, 'cardigan'],
  [/hoodie|hooded sweatshirt|sweatshirt/, 'hoodie'],
  [/rain boot|rubber boot|wellington/, 'rainboots'],
  [/waterproof boot|snow boot|winter boot/, 'waterproofboots'],
  [/chelsea/, 'chelsea'],
  [/running shoe|runner\b|running sneaker/, 'runners'],
  [/sneaker|trainer\b|court shoe/, 'sneakers'],
  [/loafer|moccasin|penny/, 'loafers'],
  [/dress shoe|derby|oxford shoe|brogue|monk strap/, 'dressshoes'],
  [/\bboots?\b|bootie/, 'boots'],
  [/sandal|flip[- ]flop|\bslides?\b/, 'sandals'],
  [/\bheels?\b|pump|stiletto/, 'heels'],
  [/ballet flat|\bflats?\b|ballerina/, 'flats'],
  [/sweater|jumper|pullover|turtleneck|mock neck|knit top|crewneck knit/, 'sweater'],
  [/\bpolo\b/, 'polo'],
  [/\b(tank|camisole|cami)\b|sleeveless top/, 'tank'],
  [/long[- ]sleeve (tee|t-shirt|top)|henley/, 'longsleeve'],
  [/t-?shirt|\btee\b/, 'tee'],
  [/blouse/, 'blouse'],
  [/button[- ]?(up|down|front)|dress shirt|oxford shirt|flannel|linen shirt|\bshirt\b/, 'shirt'],
  [/jogger|sweatpant/, 'joggers'],
  [/legging|tights/, 'leggings'],
  [/cargo/, 'cargo'],
  [/\bjeans?\b|denim (pant|trouser)/, 'jeans'],
  [/chino/, 'chinos'],
  [/trouser|slacks|dress pant|suit pant/, 'trousers'],
  [/shorts?\b/, 'shorts'],
  [/skirt/, 'skirt'],
  [/scarf/, 'scarf'],
  [/beanie|knit hat|winter hat/, 'beanie'],
  [/glove|mitten/, 'gloves'],
  [/sunglass/, 'sunglasses'],
  [/baseball cap|\bcap\b/, 'cap'],
  [/sun hat|bucket hat|straw hat/, 'sunhat'],
  [/umbrella/, 'umbrella'],
  [/\bbelt\b/, 'belt'],
  [/\bwatch\b/, 'watch'],
  [/\b(bag|tote|backpack|crossbody)\b/, 'bag']
];

export function inferType(...texts) {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  for (const [re, type] of TYPE_RULES) if (re.test(hay) && TYPES[type]) return type;
  return null;
}

const COLOR_WORDS = [
  ['off-white', 'cream'], ['off white', 'cream'], ['ivory', 'cream'], ['ecru', 'cream'], ['oatmeal', 'beige'], ['sand', 'beige'], ['stone', 'beige'], ['taupe', 'beige'], ['tan', 'beige'],
  ['charcoal', 'charcoal'], ['heather grey', 'grey'], ['heather gray', 'grey'], ['light grey', 'light grey'], ['light gray', 'light grey'], ['silver', 'light grey'], ['gray', 'grey'], ['grey', 'grey'],
  ['navy', 'navy'], ['midnight', 'navy'], ['indigo', 'denim'], ['light wash', 'light denim'], ['light denim', 'light denim'], ['dark wash', 'denim'], ['denim', 'denim'], ['sky blue', 'sky blue'], ['light blue', 'sky blue'], ['baby blue', 'sky blue'], ['royal blue', 'royal blue'], ['cobalt', 'royal blue'], ['teal', 'teal'], ['blue', 'royal blue'],
  ['forest green', 'forest green'], ['hunter green', 'forest green'], ['emerald', 'forest green'], ['olive', 'olive'], ['army green', 'olive'], ['khaki', 'khaki'], ['sage', 'sage'], ['mint', 'sage'], ['green', 'forest green'],
  ['burgundy', 'burgundy'], ['wine', 'burgundy'], ['maroon', 'burgundy'], ['oxblood', 'burgundy'], ['rust', 'rust'], ['terracotta', 'rust'], ['brick', 'rust'], ['red', 'red'],
  ['mustard', 'mustard'], ['gold', 'mustard'], ['yellow', 'yellow'], ['orange', 'orange'], ['camel', 'camel'], ['cognac', 'camel'], ['chocolate', 'brown'], ['espresso', 'brown'], ['brown', 'brown'],
  ['blush', 'blush'], ['rose', 'blush'], ['pink', 'pink'], ['lavender', 'lavender'], ['lilac', 'lavender'], ['purple', 'purple'], ['plum', 'purple'],
  ['black', 'black'], ['white', 'white'], ['cream', 'cream'], ['beige', 'beige']
];
const PALETTE_HEX = new Map(PALETTE.map((p) => [p.name, p.hex]));

/** Resolve free-text colour to a palette name. */
export function inferColor(...texts) {
  const hay = ` ${texts.filter(Boolean).join(' ').toLowerCase()} `;
  for (const [word, name] of COLOR_WORDS) if (new RegExp(`[^a-z]${word.replace(/[-]/g, '[- ]')}[^a-z]`).test(hay)) return name;
  return null;
}

export function inferGender(...texts) {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  if (/\b(women'?s?|womens|female|ladies|girls?)\b/.test(hay)) return 'women';
  if (/\b(men'?s?|mens|male|boys?)\b/.test(hay)) return 'men';
  if (/\bunisex\b/.test(hay)) return 'unisex';
  return 'unisex';
}

export function inferPattern(text) {
  const t = (text || '').toLowerCase();
  if (/stripe|breton/.test(t)) return 'striped';
  if (/plaid|check|gingham|tartan/.test(t)) return 'checked';
  if (/floral|flower/.test(t)) return 'floral';
  if (/graphic|print(ed)? tee|logo/.test(t)) return 'graphic';
  if (/leopard|animal|zebra|snake/.test(t)) return 'animal';
  if (/polka|dotted|\bdot\b/.test(t)) return 'dotted';
  return 'solid';
}

/**
 * Feeds write prices as "29.99", "29,99 EUR", "1,299.00" or "1.299,00". The last separator is the
 * decimal point when it is followed by one or two digits; otherwise separators group thousands.
 */
export function parsePriceCents(value) {
  if (value == null || value === '') return null;
  const m = String(value).match(/\d[\d.,]*/);
  if (!m) return null;
  const raw = m[0].replace(/[.,]+$/, '');
  const last = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  let normal = raw;
  if (last >= 0 && raw.length - last - 1 <= 2) normal = `${raw.slice(0, last).replace(/[.,]/g, '')}.${raw.slice(last + 1)}`;
  else normal = raw.replace(/[.,]/g, '');
  const cents = Math.round(Number(normal) * 100);
  return Number.isFinite(cents) && cents > 0 && cents < 5_000_000 ? cents : null;
}

const ALIASES = {
  sku: ['sku', 'id', 'product_id', 'productid', 'item_id', 'itemid', 'upc', 'mpn'],
  title: ['title', 'name', 'product_name', 'productname', 'product_title'],
  url: ['url', 'link', 'product_url', 'producturl', 'buy_url', 'buyurl', 'deeplink', 'tracking_url', 'affiliate_url', 'product_link'],
  image: ['image', 'image_url', 'imageurl', 'image_link', 'imagelink', 'large_image', 'primary_image', 'image_1', 'picture'],
  price: ['sale_price', 'price', 'current_price', 'currentprice', 'retail_price', 'retailprice'],
  color: ['color', 'colour', 'colors', 'color_name'],
  gender: ['gender', 'department', 'sex', 'audience'],
  category: ['category', 'product_type', 'google_product_category', 'categories', 'type', 'category_path'],
  brand: ['brand', 'manufacturer', 'vendor'],
  description: ['description', 'short_description', 'desc'],
  availability: ['availability', 'in_stock', 'instock', 'stock_status'],
  currency: ['currency']
};

/** @param {Record<string,string>} row @param {Record<string,string>} overrides field → column */
function pick(row, field, overrides) {
  if (overrides[field]) return row[overrides[field].toLowerCase()] ?? '';
  for (const key of ALIASES[field]) if (row[key]) return row[key];
  return '';
}

const httpsUrl = (u) => {
  try {
    const url = new URL(u.startsWith('//') ? `https:${u}` : u);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/**
 * Map raw feed rows to catalogue rows.
 * @param {Record<string,string>[]} rows lower-cased column names
 * @param {{retailer:string, map?:Record<string,string>, limit?:number}} opts
 * @returns {{products:object[], skipped:{index:number, reason:string}[]}}
 */
export function mapFeed(rows, { retailer, map = {}, limit = Infinity }) {
  const products = [];
  const skipped = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    if (products.length >= limit) return;
    const title = pick(row, 'title', map).slice(0, 200);
    const sku = pick(row, 'sku', map) || title;
    const url = httpsUrl(pick(row, 'url', map));
    const imageUrl = httpsUrl(pick(row, 'image', map));
    const category = pick(row, 'category', map);
    const description = pick(row, 'description', map);
    if (!title) return skipped.push({ index, reason: 'no title' });
    if (!url) return skipped.push({ index, reason: 'no valid https product link' });
    if (!imageUrl) return skipped.push({ index, reason: 'no valid https image' });

    const type = inferType(title, category);
    if (!type) return skipped.push({ index, reason: `could not tell what kind of garment "${title.slice(0, 40)}" is` });
    const rawColor = pick(row, 'color', map);
    let color = inferColor(rawColor) ?? inferColor(title);
    if (!color && isHex(rawColor)) color = nearestSwatch(rawColor).name;
    if (!color) return skipped.push({ index, reason: `unrecognised colour for "${title.slice(0, 40)}"` });

    const availability = pick(row, 'availability', map).toLowerCase();
    const inStock = !/^(out|sold|unavail|not\b|no\b|false|0$|discontinued)/.test(availability);
    const id = `${retailer}:${sku}`;
    if (seen.has(id)) return skipped.push({ index, reason: 'duplicate sku' });
    seen.add(id);

    products.push({
      retailer,
      sku: String(sku).slice(0, 80),
      title,
      brand: pick(row, 'brand', map).slice(0, 60),
      url,
      imageUrl,
      priceCents: parsePriceCents(pick(row, 'price', map)),
      currency: (pick(row, 'currency', map) || 'USD').slice(0, 3).toUpperCase(),
      category: TYPES[type].category,
      type,
      color,
      gender: inferGender(pick(row, 'gender', map), category, title),
      pattern: inferPattern(`${title} ${description}`),
      keywords: `${title} ${category}`.toLowerCase().slice(0, 300),
      inStock
    });
  });
  return { products, skipped };
}

export { PALETTE_HEX };
