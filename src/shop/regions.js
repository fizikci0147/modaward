/**
 * Where a person shops. A store ships to some regions, and the starter set of stores used when someone has picked none
 * is chosen per region, so a person in Germany is not shown American department stores that will not deliver.
 */
import { L } from '../shared/i18n.js';

/** Region code → English name (translated where it is shown). Germany stands for Austria and Switzerland too. */
export const REGIONS = Object.freeze({
  US: L('United States'),
  CA: L('Canada'),
  GB: L('United Kingdom'),
  AU: L('Australia'),
  DE: L('Germany, Austria and Switzerland'),
  FR: L('France'),
  ES: L('Spain'),
  IT: L('Italy'),
  PT: L('Portugal'),
  NL: L('Netherlands'),
  TR: L('Türkiye'),
  BR: L('Brazil'),
  MX: L('Mexico')
});
export const REGION_CODES = Object.freeze(Object.keys(REGIONS));

const BY_CURRENCY = { USD: 'US', CAD: 'CA', GBP: 'GB', AUD: 'AU', TRY: 'TR', BRL: 'BR', MXN: 'MX', CHF: 'DE' };
const BY_LOCALE = { de: 'DE', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT', tr: 'TR' };

/** The person's region: their own choice, else a guess from their currency and language, else the United States. */
export function shopRegion(profile) {
  if (profile?.shopRegion && REGIONS[profile.shopRegion]) return profile.shopRegion;
  const byCurrency = BY_CURRENCY[profile?.currency];
  if (byCurrency) return byCurrency;
  if (profile?.currency === 'EUR') return BY_LOCALE[profile?.locale] || 'DE';
  return BY_LOCALE[profile?.locale] || 'US';
}
