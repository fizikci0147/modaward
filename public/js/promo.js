import { tn } from '/js/i18n.js';

/** "3 months of Pro, free for new members" for an offer of `days` days ('' when there is no offer). */
export function promoLine(days) {
  if (!(days > 0)) return '';
  return days % 30 === 0
    ? tn(days / 30, '{n} month of Pro, free for new members', '{n} months of Pro, free for new members')
    : tn(days, '{n} day of Pro, free for new members', '{n} days of Pro, free for new members');
}
