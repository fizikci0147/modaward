import { cToF, kphToMph } from '/shared/weather-codes.js';

export const temp = (c, units) => Math.round(units === 'imperial' ? cToF(c) : c);
export const tempStr = (c, units) => `${temp(c, units)}°`;
export const wind = (kph, units) => (units === 'imperial' ? `${Math.round(kphToMph(kph))} mph` : `${Math.round(kph)} km/h`);
export const hour12 = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Dates are plain YYYY-MM-DD in the forecast location's timezone: parse without timezone shifts. */
export const parseDate = (s) => new Date(`${s}T12:00:00Z`);
export const dow = (s) => DOW[parseDate(s).getUTCDay()];
export const dayNum = (s) => parseDate(s).getUTCDate();
export const longDate = (s) => `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseDate(s).getUTCDay()]}, ${MONTH[parseDate(s).getUTCMonth()]} ${parseDate(s).getUTCDate()}`;

export const money = (cents, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

export function greeting(hour, name) {
  const part = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name.split(' ')[0]}` : part;
}

export const cx = (...parts) => parts.filter(Boolean).join(' ');
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '·';
export const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
