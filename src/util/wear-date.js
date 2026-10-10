import { badRequest } from './errors.js';
import { daysBetween } from '../shared/dormancy.js';

/** A wear date may be backdated up to three years, and at most a day ahead (time zones). */
export function assertPlausibleDate(date) {
  const today = new Date().toISOString().slice(0, 10);
  const ago = daysBetween(date, today);
  if (Number.isNaN(ago) || ago < -1 || ago > 3 * 365) throw badRequest('That date is out of range.');
}
