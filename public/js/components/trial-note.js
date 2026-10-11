import { html, useState } from '/js/ui.js';
import { t, getLocale } from '/js/i18n.js';
import { useStore } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { Link } from '/js/router.js';
import { canBuyProHere } from '/js/native.js';

const WINDOW_DAYS = 14;
const key = (until) => `mw-trial-note-${until}`;
const dismissedBefore = (until) => {
  try {
    return localStorage.getItem(key(until)) === '1';
  } catch {
    return false;
  }
};

/** In the last two weeks of free Pro: when it ends, and a way to keep it. Can be put away; it comes back for the next end date. */
export function TrialNote() {
  const { user } = useStore();
  const until = user?.planStatus === 'granted' ? user.planRenewsAt : null;
  const [gone, setGone] = useState(() => (until ? dismissedBefore(until) : false));
  const left = until ? until - Date.now() / 1000 : null;
  if (!until || gone || left <= 0 || left > WINDOW_DAYS * 86400) return null;
  const hide = () => {
    setGone(true);
    try {
      localStorage.setItem(key(until), '1');
    } catch {
      /* it simply shows again next time */
    }
  };
  return html`<div class="trial-note" role="status">
    <${Icon} name="sparkle" size="18" />
    <span>${t('Your free Pro ends on {date}.', { date: new Date(until * 1000).toLocaleDateString(getLocale(), { dateStyle: 'long' }) })}</span>
    ${canBuyProHere ? html`<${Link} href="/pro" class="btn btn-primary btn-s">${t('Keep Pro')}</${Link}>` : null}
    <button class="icon-btn" onClick=${hide} aria-label=${t('Close')}><${Icon} name="x" size="16" /></button>
  </div>`;
}
