import { cToF, kphToMph } from '/shared/weather-codes.js';
import { t, getLocale } from '/js/i18n.js';

export const temp = (c, units) => Math.round(units === 'imperial' ? cToF(c) : c);
export const tempStr = (c, units) => `${temp(c, units)}°`;
export const wind = (kph, units) => (units === 'imperial' ? `${Math.round(kphToMph(kph))} mph` : `${Math.round(kph)} km/h`);

// Dates are plain YYYY-MM-DD in the forecast location's timezone: parse without timezone shifts.
export const parseDate = (s) => new Date(`${s}T12:00:00Z`);
const dateFmt = (options) => new Intl.DateTimeFormat(getLocale() === 'en' ? 'en-US' : getLocale(), { timeZone: 'UTC', ...options });
export const dow = (s) => dateFmt({ weekday: 'short' }).format(parseDate(s));
/** Short weekday name for 0 = Sunday … 6 = Saturday, in the current language. */
export const weekdayShort = (i) => dateFmt({ weekday: 'short' }).format(new Date(Date.UTC(2023, 0, 1 + i)));
export const dayNum = (s) => parseDate(s).getUTCDate();
export const longDate = (s) => dateFmt({ weekday: 'long', month: 'short', day: 'numeric' }).format(parseDate(s));

/** 15 → "3pm" in English, "15:00"-style or "3 PM" per language elsewhere. */
export const hour12 = (h) => (getLocale() === 'en' ? `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}` : dateFmt({ hour: 'numeric' }).format(Date.UTC(2000, 0, 1, h)));

export const money = (cents, currency = 'USD') =>
  new Intl.NumberFormat(getLocale() === 'en' ? 'en-US' : getLocale(), { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

export function greeting(hour, name) {
  const first = name ? name.split(' ')[0] : '';
  if (!first) return hour < 5 ? t('Still up') : hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening');
  return hour < 5 ? t('Still up, {name}', { name: first }) : hour < 12 ? t('Good morning, {name}', { name: first }) : hour < 18 ? t('Good afternoon, {name}', { name: first }) : t('Good evening, {name}', { name: first });
}

export const cx = (...parts) => parts.filter(Boolean).join(' ');
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '·';
export const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
