/**
 * How long a piece has sat unworn. Shared by the closet screens, the outfit engine (which
 * gently brings forgotten pieces back) and the reminder emails, so they all agree.
 */

/** A piece worn before, but not for this long, counts as forgotten. */
export const DORMANT_DAYS = 60;
/** A piece never worn is forgotten this long after it was added (people need a moment first). */
export const UNWORN_GRACE_DAYS = 21;

const DAY_MS = 86_400_000;
const toUtc = (s) => Date.parse(`${s}T12:00:00Z`);

/** Whole days between two YYYY-MM-DD dates (b − a). */
export const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);

/** YYYY-MM-DD for a unix-seconds timestamp, in UTC. */
export const dateOfUnix = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * @param {{lastWornOn?: string|null, createdAt?: number}} garment
 * @param {string} today YYYY-MM-DD
 * @returns {{days:number, never:boolean}} days since last worn, or since it was added when never worn
 */
export function idleInfo(garment, today) {
  if (garment.lastWornOn) return { days: Math.max(0, daysBetween(garment.lastWornOn, today)), never: false };
  const added = garment.createdAt ? dateOfUnix(garment.createdAt) : today;
  return { days: Math.max(0, daysBetween(added, today)), never: true };
}

/** True when the piece has gone unworn long enough to point out. */
export function isDormant(garment, today) {
  if (garment.archived) return false;
  const { days, never } = idleInfo(garment, today);
  return days >= (never ? UNWORN_GRACE_DAYS : DORMANT_DAYS);
}

/** The forgotten pieces, longest unworn first. Never-worn pieces rank by how long they have been owned. */
export function dormantPieces(garments, today) {
  return garments
    .map((g) => ({ g, ...idleInfo(g, today) }))
    .filter((x) => isDormant(x.g, today))
    .sort((a, b) => b.days - a.days)
    .map((x) => ({ ...x.g, idleDays: x.days, neverWorn: x.never }));
}

/**
 * "3 weeks ago", "yesterday", "2 months ago", in the person's language.
 * Intl does the grammar, so this needs no translation files.
 */
export function agoText(days, locale = 'en') {
  let rtf;
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }
  if (days <= 0) return rtf.format(0, 'day');
  if (days < 14) return rtf.format(-days, 'day');
  if (days < 60) return rtf.format(-Math.round(days / 7), 'week');
  if (days < 700) return rtf.format(-Math.round(days / 30.4), 'month');
  return rtf.format(-Math.round(days / 365), 'year');
}
