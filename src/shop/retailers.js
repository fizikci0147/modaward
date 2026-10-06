/**
 * Retailer registry and link building.
 *
 * Search links are real, always-valid URLs: the retailer's own search page for the piece we
 * recommend. Where a retailer's native search URL is not one we are certain about, we fall
 * back to a Google `site:` search, which stays correct even if the retailer changes its URLs.
 * All templates live here so a wrong one is a one-line fix.
 *
 * Region: United States (US storefronts).
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
 * @property {string|null} search               native search URL with {q}, or null to use the site: fallback
 */

/** @type {Retailer[]} */
export const RETAILERS = [
  { id: 'uniqlo', name: 'Uniqlo', domain: 'uniqlo.com', tier: 'value', departments: ['men', 'women'], styles: { minimal: 0.95, casual: 0.9, classic: 0.6, sporty: 0.5, polished: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'accessory'], search: 'https://www.uniqlo.com/us/en/search?q={q}' },
  { id: 'hm', name: 'H&M', domain: 'hm.com', tier: 'value', departments: ['men', 'women'], styles: { casual: 0.8, street: 0.75, minimal: 0.6, boho: 0.55, sporty: 0.4, classic: 0.45, polished: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: 'https://www2.hm.com/en_us/search-results.html?q={q}' },
  { id: 'gap', name: 'Gap', domain: 'gap.com', tier: 'value', departments: ['men', 'women'], styles: { casual: 0.9, classic: 0.7, minimal: 0.5, sporty: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'accessory'], search: 'https://www.gap.com/browse/search.do?searchText={q}' },
  { id: 'oldnavy', name: 'Old Navy', domain: 'oldnavy.gap.com', tier: 'value', departments: ['men', 'women'], styles: { casual: 0.9, sporty: 0.55, classic: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes'], search: 'https://oldnavy.gap.com/browse/search.do?searchText={q}' },
  { id: 'target', name: 'Target', domain: 'target.com', tier: 'value', departments: ['men', 'women'], styles: { casual: 0.9, sporty: 0.5, minimal: 0.5, boho: 0.4, classic: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: 'https://www.target.com/s?searchTerm={q}' },
  { id: 'asos', name: 'ASOS', domain: 'asos.com', tier: 'value', departments: ['men', 'women'], styles: { street: 0.95, casual: 0.7, boho: 0.65, minimal: 0.55, polished: 0.5, sporty: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: 'https://www.asos.com/us/search/?q={q}' },
  { id: 'zara', name: 'Zara', domain: 'zara.com', tier: 'mid', departments: ['men', 'women'], styles: { minimal: 0.85, polished: 0.85, street: 0.6, classic: 0.6, boho: 0.45 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: 'https://www.zara.com/us/en/search?searchTerm={q}' },
  { id: 'mango', name: 'Mango', domain: 'shop.mango.com', tier: 'mid', departments: ['women', 'men'], styles: { polished: 0.85, minimal: 0.8, boho: 0.6, classic: 0.6, street: 0.4 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: null },
  { id: 'madewell', name: 'Madewell', domain: 'madewell.com', tier: 'mid', departments: ['women', 'men'], styles: { casual: 0.9, boho: 0.75, minimal: 0.6, classic: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: null },
  { id: 'bananarepublic', name: 'Banana Republic', domain: 'bananarepublic.gap.com', tier: 'mid', departments: ['men', 'women'], styles: { classic: 0.95, polished: 0.9, minimal: 0.7, casual: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: 'https://bananarepublic.gap.com/browse/search.do?searchText={q}' },
  { id: 'jcrew', name: 'J.Crew', domain: 'jcrew.com', tier: 'mid', departments: ['men', 'women'], styles: { classic: 0.95, polished: 0.7, casual: 0.65, minimal: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: null },
  { id: 'everlane', name: 'Everlane', domain: 'everlane.com', tier: 'mid', departments: ['men', 'women'], styles: { minimal: 0.95, classic: 0.6, casual: 0.6, polished: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: null },
  { id: 'nike', name: 'Nike', domain: 'nike.com', tier: 'mid', departments: ['men', 'women'], styles: { sporty: 1, street: 0.8, casual: 0.5 }, carries: ['top', 'bottom', 'outerwear', 'shoes', 'accessory'], search: 'https://www.nike.com/w?q={q}' },
  { id: 'nordstrom', name: 'Nordstrom', domain: 'nordstrom.com', tier: 'premium', departments: ['men', 'women'], styles: { classic: 0.75, polished: 0.8, minimal: 0.7, casual: 0.6, street: 0.5, boho: 0.5, sporty: 0.5 }, carries: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'], search: 'https://www.nordstrom.com/sr?keyword={q}' }
];

export const RETAILER_IDS = RETAILERS.map((r) => r.id);
const BY_ID = new Map(RETAILERS.map((r) => [r.id, r]));
export const retailerById = (id) => BY_ID.get(id);

/** Plain retailer search URL for a query. */
export function searchUrl(retailer, query) {
  const q = query.trim().replace(/\s+/g, ' ');
  if (retailer.search) return retailer.search.replace('{q}', encodeURIComponent(q));
  return `https://www.google.com/search?q=${encodeURIComponent(`${q} site:${retailer.domain}`)}`;
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
