import { parseStores } from './store-data.js';

/**
 * Retailer registry and link building.
 *
 * Search links are real, always-valid URLs: the retailer's own search page for the piece we
 * recommend. Where a retailer's native search URL is not one we are certain about, we fall
 * back to a Google `site:` search, which stays correct even if the retailer changes its URLs.
 * All templates live here so a wrong one is a one-line fix.
 *
 * Stores are grouped by region (regions.js). The original fourteen US stores are tuned by hand below; the rest of the
 * database lives in store-data.js. A person can also add their own store (see customRetailer).
 */

/**
 * @typedef {object} Retailer
 * @property {string} id
 * @property {string} name
 * @property {string} domain
 * @property {'value'|'mid'|'premium'} tier
 * @property {('men'|'women')[]} departments
 * @property {Record<string, number>} styles   fit with each style archetype, 0–1
 * @property {string[]} carries                 garment categories
 * @property {string|Record<string,string>|null} search  native search URL with {q} (or one per region), or null to use the site: fallback
 * @property {string[]} regions                 region codes it ships to, or ['*'] for everywhere
 * @property {string[]} core                    regions where it is in the starter set (used when the person has picked no stores)
 * @property {boolean} [custom]                 added by the person, not part of the built-in database
 */

const ALL = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'TR', 'BR', 'MX'];

/** @type {Retailer[]} The original stores, with hand-tuned character and US search pages. */
const TUNED = [
  { id: 'uniqlo', name: 'Uniqlo', domain: 'uniqlo.com', tier: 'value', departments: ['men', 'women'], styles: { minimal: 0.95, casual: 0.9, classic: 0.6, sporty: 0.5, polished: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'accessory'], search: { US: 'https://www.uniqlo.com/us/en/search?q={q}' }, regions: ['*'], core: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL'] },
  { id: 'hm', name: 'H&M', domain: 'hm.com', tier: 'value', departments: ['men', 'women'], styles: { casual: 0.8, street: 0.75, minimal: 0.6, boho: 0.55, sporty: 0.4, classic: 0.45, polished: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: { US: 'https://www2.hm.com/en_us/search-results.html?q={q}' }, regions: ['*'], core: ALL },
  { id: 'gap', name: 'Gap', domain: 'gap.com', tier: 'value', departments: ['men', 'women'], styles: { casual: 0.9, classic: 0.7, minimal: 0.5, sporty: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'accessory'], search: { US: 'https://www.gap.com/browse/search.do?searchText={q}' }, regions: ['US'], core: ['US'] },
  { id: 'oldnavy', name: 'Old Navy', domain: 'oldnavy.gap.com', tier: 'value', departments: ['men', 'women'], styles: { casual: 0.9, sporty: 0.55, classic: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes'], search: { US: 'https://oldnavy.gap.com/browse/search.do?searchText={q}' }, regions: ['US'], core: ['US'] },
  { id: 'target', name: 'Target', domain: 'target.com', tier: 'value', departments: ['men', 'women'], styles: { casual: 0.9, sporty: 0.5, minimal: 0.5, boho: 0.4, classic: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: { US: 'https://www.target.com/s?searchTerm={q}' }, regions: ['US'], core: ['US'] },
  { id: 'asos', name: 'ASOS', domain: 'asos.com', tier: 'value', departments: ['men', 'women'], styles: { street: 0.95, casual: 0.7, boho: 0.65, minimal: 0.55, polished: 0.5, sporty: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: { US: 'https://www.asos.com/us/search/?q={q}' }, regions: ['*'], core: ['US', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL'] },
  { id: 'zara', name: 'Zara', domain: 'zara.com', tier: 'mid', departments: ['men', 'women'], styles: { minimal: 0.85, polished: 0.85, street: 0.6, classic: 0.6, boho: 0.45 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: { US: 'https://www.zara.com/us/en/search?searchTerm={q}' }, regions: ['*'], core: ALL },
  { id: 'mango', name: 'Mango', domain: 'shop.mango.com', tier: 'mid', departments: ['women', 'men'], styles: { polished: 0.85, minimal: 0.8, boho: 0.6, classic: 0.6, street: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: null, regions: ['*'], core: ALL },
  { id: 'madewell', name: 'Madewell', domain: 'madewell.com', tier: 'mid', departments: ['women', 'men'], styles: { casual: 0.9, boho: 0.75, minimal: 0.6, classic: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: null, regions: ['US', 'CA', 'GB'], core: ['US'] },
  { id: 'bananarepublic', name: 'Banana Republic', domain: 'bananarepublic.gap.com', tier: 'mid', departments: ['men', 'women'], styles: { classic: 0.95, polished: 0.9, minimal: 0.7, casual: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: { US: 'https://bananarepublic.gap.com/browse/search.do?searchText={q}' }, regions: ['US'], core: ['US'] },
  { id: 'jcrew', name: 'J.Crew', domain: 'jcrew.com', tier: 'mid', departments: ['men', 'women'], styles: { classic: 0.95, polished: 0.7, casual: 0.65, minimal: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: null, regions: ['US', 'CA', 'GB'], core: ['US'] },
  { id: 'everlane', name: 'Everlane', domain: 'everlane.com', tier: 'mid', departments: ['men', 'women'], styles: { minimal: 0.95, classic: 0.6, casual: 0.6, polished: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: null, regions: ['*'], core: ['US'] },
  { id: 'nike', name: 'Nike', domain: 'nike.com', tier: 'mid', departments: ['men', 'women'], styles: { sporty: 1, street: 0.8, casual: 0.5 }, carries: ['top', 'bottom', 'outerwear', 'shoes', 'accessory'], search: { US: 'https://www.nike.com/w?q={q}' }, regions: ['*'], core: ALL },
  { id: 'nordstrom', name: 'Nordstrom', domain: 'nordstrom.com', tier: 'premium', departments: ['men', 'women'], styles: { classic: 0.75, polished: 0.8, minimal: 0.7, casual: 0.6, street: 0.5, boho: 0.5, sporty: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: { US: 'https://www.nordstrom.com/sr?keyword={q}' }, regions: ['US', 'CA'], core: ['US'] }
];

const TUNED_IDS = new Set(TUNED.map((r) => r.id));

/** @type {Retailer[]} Every built-in store: the tuned ones first (in their original order), then the database. */
export const RETAILERS = [...TUNED, ...parseStores().filter((r) => !TUNED_IDS.has(r.id))];

export const RETAILER_IDS = RETAILERS.map((r) => r.id);
const BY_ID = new Map(RETAILERS.map((r) => [r.id, r]));
export const retailerById = (id) => BY_ID.get(id);

/**
 * Plain retailer search URL for a query. Where we know a store's own search page for the person's region we use it; otherwise
 * a Google site: search of the store, which stays correct even if the store changes its URLs.
 */
export function searchUrl(retailer, query, region = 'US') {
  const q = query.trim().replace(/\s+/g, ' ');
  const template = typeof retailer.search === 'string' ? retailer.search : retailer.search?.[region] ?? retailer.search?.['*'] ?? null;
  if (template) return template.replace('{q}', encodeURIComponent(q));
  return `https://www.google.com/search?q=${encodeURIComponent(`${q} site:${retailer.domain}`)}`;
}

const NEUTRAL_STYLES = { minimal: 0.6, casual: 0.6, classic: 0.6, street: 0.6, boho: 0.6, polished: 0.6, sporty: 0.6 };
export const CUSTOM_PREFIX = 'c_';

/** A store the person added, as a retailer: mid-priced, carrying everything, with no particular character. */
export function customRetailer(row) {
  return {
    id: `${CUSTOM_PREFIX}${row.id}`,
    name: row.name,
    domain: row.domain,
    tier: 'mid',
    departments: ['men', 'women'],
    styles: NEUTRAL_STYLES,
    carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'],
    search: row.search || null,
    regions: ['*'],
    core: [],
    custom: true
  };
}

/**
 * Wrap a destination URL in the retailer's affiliate tracking link, if one is configured.
 * `templates` maps retailer id → URL containing `{url}` (URL-encoded destination) and optionally
 * `{subid}`. Example (Impact): "https://brand.sjv.io/c/12345/67890/1111?u={url}&subId1={subid}".
 */
export function affiliateUrl(templates, retailerId, destination, subid = '') {
  const template = templates?.[retailerId];
  if (!template || !template.includes('{url}')) return destination;
  return template.replace('{url}', encodeURIComponent(destination)).replace('{subid}', encodeURIComponent(subid));
}

/** The host a destination URL points at, for click logs and the redirect allow-list. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}
