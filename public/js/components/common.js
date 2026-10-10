import { html, useEffect, useRef, useState } from '/js/ui.js';
import { t, tx, getLocale, LOCALES, ENABLED_LOCALES } from '/js/i18n.js';
import { L } from '/shared/i18n.js';
import { Icon, Logo } from '/js/icons.js';
import { useStore, dismissToast, closeUpgrade, toast, fail, state, setLocale, acceptTerms } from '/js/store.js';
import { api } from '/js/api.js';
import { navigate } from '/js/router.js';

// Sheets can open on top of each other (a confirmation over a form): only the top one answers
// Esc and Tab, and the page behind stays locked until the last one closes.
const openSheets = [];

/** Bottom sheet on phones, centred dialog on desktop. Closes on Esc, scrim click and swipe-free. */
export function Sheet({ title, onClose, children, footer, wide = false, label }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // the latest handler, not the one from the first render
  useEffect(() => {
    const prev = document.activeElement;
    const me = {};
    openSheets.push(me);
    const isTop = () => openSheets[openSheets.length - 1] === me;
    const focusables = () => [...(ref.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])].filter((el) => !el.disabled && el.offsetParent !== null);
    const onKey = (e) => {
      if (!isTop()) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const f = focusables();
        if (!f.length) return e.preventDefault();
        const first = f[0];
        const last = f[f.length - 1];
        if (!ref.current.contains(document.activeElement)) (e.preventDefault(), first.focus());
        else if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // start inside the dialog: the marked field, else the first control, else the dialog itself
    (ref.current?.querySelector('[data-autofocus]') || focusables()[0] || ref.current)?.focus?.();
    return () => {
      document.removeEventListener('keydown', onKey);
      openSheets.splice(openSheets.indexOf(me), 1);
      if (!openSheets.length) document.body.style.overflow = '';
      if (prev?.isConnected) prev.focus?.();
    };
  }, []);
  return html`<div class="scrim" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label=${label || title} tabindex="-1" ref=${ref}>
      <div class="grab"></div>
      <div class="sheet-head">
        <h2 class="display h-s">${title}</h2>
        <button class="icon-btn" onClick=${onClose} aria-label=${t('Close')}><${Icon} name="x" /></button>
      </div>
      <div class="sheet-body">${children}</div>
      ${footer ? html`<div class="sheet-foot">${footer}</div>` : null}
    </div>
  </div>`;
}

export function Toasts() {
  const { toasts } = useStore();
  return html`<div class="toasts" role="status" aria-live="polite">
    ${toasts.map((n) => html`<div class=${`toast ${n.kind === 'err' ? 'err' : ''}`} key=${n.id}>
      <${Icon} name=${n.kind === 'err' ? 'info' : 'check'} />
      <span>${n.message}</span>
      ${n.action ? html`<button onClick=${() => { n.action.run(); dismissToast(n.id); }}>${n.action.label}</button>` : null}
    </div>`)}
  </div>`;
}

export const Spinner = ({ class: cls = '' }) => html`<span class=${`spinner ${cls}`} role="progressbar" aria-label=${t('Loading')}></span>`;

export function Switch({ checked, onChange, label }) {
  return html`<button type="button" class="switch" role="switch" aria-checked=${checked ? 'true' : 'false'} aria-label=${label} onClick=${() => onChange(!checked)}></button>`;
}

export function Empty({ title, text, children, art }) {
  return html`<div class="empty">
    ${art ? html`<div class="art-pair">${art}</div>` : null}
    <div class="stack" style=${{ gap: '8px', justifyItems: 'center' }}>
      <h2 class="display h-m">${title}</h2>
      ${text ? html`<p class="muted" style=${{ maxWidth: '44ch' }}>${text}</p>` : null}
    </div>
    ${children}
  </div>`;
}

const PRO_COPY = {
  closet: [L('An unlimited closet'), L('Add every piece you own and get outfits built from all of it.')],
  plan: [L('Plan the whole week'), L('See outfits for all seven days ahead, matched to each day’s forecast.')],
  saved: [L('Save every look'), L('Keep as many looks as you like and come back to them any time.')],
  pro: [L('ModaWard Pro'), L('The full stylist experience.')]
};

export const PRO_FEATURES = [
  L('Unlimited closet and saved looks'),
  L('Outfits planned for every day of the week'),
  L('The full shopping feed: dozens of looks, mixed across brands'),
  L('AI stylist notes and photo auto-tagging'),
  L('Early access to new features')
];

export async function startCheckout(interval) {
  try {
    const { url } = await api.post('/billing/checkout', { interval });
    location.href = url;
  } catch (e) {
    fail(e);
    throw e;
  }
}

export function UpgradeSheet() {
  const { upgrade, capabilities } = useStore();
  const [busy, setBusy] = useState('');
  if (!upgrade) return null;
  const [title, text] = (PRO_COPY[upgrade.reason] || PRO_COPY.pro).map((x) => t(x));
  const go = async (interval) => {
    setBusy(interval);
    try {
      await startCheckout(interval);
    } catch {
      setBusy('');
    }
  };
  return html`<${Sheet} title=${title} onClose=${closeUpgrade} label=${t('Upgrade to Pro')}>
    <p class="muted" style=${{ marginTop: '-8px' }}>${upgrade.message || text}</p>
    <ul class="stack" style=${{ gap: '10px' }}>
      ${PRO_FEATURES.map((f) => html`<li class="row" style=${{ alignItems: 'flex-start' }}><${Icon} name="check" class="" size="18" /><span>${t(f)}</span></li>`)}
    </ul>
    ${capabilities.billing
      ? html`<div class="stack">
          <button class="btn btn-primary btn-l btn-block" disabled=${!!busy} onClick=${() => go('year')}>${busy === 'year' ? html`<${Spinner} />` : t('Yearly · $59 (save 38%)')}</button>
          <button class="btn btn-outline btn-block" disabled=${!!busy} onClick=${() => go('month')}>${busy === 'month' ? html`<${Spinner} />` : t('Monthly · $7.99')}</button>
          <p class="footnote center">${t('Cancel any time from your profile. Billed securely by Stripe.')}</p>
        </div>`
      : html`<div class="banner"><${Icon} name="info" />${t('Online payments are not switched on for this site yet.')}</div>`}
  </${Sheet}>`;
}

/** City search + "use my location". Used by onboarding, Today and Profile. */
export function LocationPicker({ onPick, compact = false }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return setResults([]);
    timer.current = setTimeout(async () => {
      try {
        setResults((await api.get(`/geo/search?q=${encodeURIComponent(q.trim())}`)).results);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  const locate = () => {
    if (!navigator.geolocation) return toast(t('Your browser cannot share its location. Search for your city instead.'), { kind: 'err' });
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onPick({ name: t('Current location'), lat: Number(pos.coords.latitude.toFixed(4)), lon: Number(pos.coords.longitude.toFixed(4)), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
      },
      () => {
        setBusy(false);
        toast(t('We could not get your location. Search for your city instead.'), { kind: 'err' });
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  };

  return html`<div class="stack">
    <div class="field">
      ${compact ? null : html`<label for="city">${t('City')}</label>`}
      <div style=${{ position: 'relative' }}>
        <input id="city" class="input" placeholder=${t('Search for your city')} autocomplete="off" value=${q} onInput=${(e) => setQ(e.target.value)} data-autofocus style=${{ paddingLeft: '42px' }} />
        <${Icon} name="search" size="18" class="faint" style=${{ position: 'absolute', left: '14px', top: '14px' }} />
      </div>
    </div>
    ${results.length ? html`<ul class="card" style=${{ overflow: 'hidden' }}>${results.map((r) => html`<li key=${r.name}><button class="row" style=${{ width: '100%', padding: '13px 16px', textAlign: 'left', borderBottom: '1px solid var(--line)' }} onClick=${() => onPick(r)}><${Icon} name="pin" size="18" class="faint" /><span>${r.name}</span></button></li>`)}</ul>` : null}
    <button class="btn btn-outline" onClick=${locate} disabled=${busy}>${busy ? html`<${Spinner} />` : html`<${Icon} name="pin" />`} ${t('Use my current location')}</button>
  </div>`;
}

/** Language switcher: native names, so people can always find their own. */
export function LanguagePicker({ class: cls = '' }) {
  const { locale } = useStore();
  if (ENABLED_LOCALES.length < 2) return null; // nothing to choose between yet
  return html`<label class=${`lang-picker ${cls}`}><${Icon} name="globe" size="16" /><span class="sr-only">${t('Language')}</span>
    <select class="input" aria-label=${t('Language')} value=${locale || getLocale()} onChange=${(e) => setLocale(e.target.value)}>${Object.entries(LOCALES).filter(([code]) => ENABLED_LOCALES.includes(code)).map(([code, name]) => html`<option key=${code} value=${code}>${name}</option>`)}</select>
  </label>`;
}

export function Wordmark() {
  return html`<span class="brand"><${Logo} size=${26} />ModaWard</span>`;
}

export function ProBadge() {
  return html`<span class="badge badge-pro"><${Icon} name="crown" size="12" />${t('Pro')}</span>`;
}

export function go(path) {
  navigate(path);
}
export { state };


/**
 * The agreement people tick to sign up: age, the Terms, the Privacy Policy, and that suggestions are
 * guidance. The links open in a new tab so nothing already typed is lost.
 */
export function Consent({ checked, onChange, id = 'consent' }) {
  const link = (href, label) => html`<a href=${href} target="_blank" rel="noopener">${label}</a>`;
  return html`<label class="consent" for=${id}>
    <input id=${id} type="checkbox" checked=${checked} onChange=${(e) => onChange(e.target.checked)} />
    <span>${tx(t('I am at least 16, I agree to the {terms} and the {privacy}, and I understand that ModaWard’s suggestions are style guidance only: I decide what I wear and buy.'), { terms: link('/terms', t('Terms')), privacy: link('/privacy', t('Privacy Policy')) })}</span>
  </label>`;
}

/** Shown once to people who signed up before the agreement existed, or when it changes. They cannot continue without it. */
export function TermsGate() {
  const { user, legal } = useStore();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user || !legal || legal.accepted) return null;
  const go = async () => {
    setBusy(true);
    try {
      await acceptTerms();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  return html`<${Sheet} title=${t('We’ve updated our terms')} onClose=${() => {}} label=${t('We’ve updated our terms')}
    footer=${html`<button class="btn btn-primary grow" disabled=${!ok || busy} onClick=${go}>${busy ? html`<${Spinner} />` : null}${t('Continue')}</button>`}>
    <div class="stack">
      <p>${tx(t('Please review the {terms} and the {privacy} and confirm to keep using ModaWard.'), { terms: html`<a href="/terms" target="_blank" rel="noopener">${t('Terms')}</a>`, privacy: html`<a href="/privacy" target="_blank" rel="noopener">${t('Privacy Policy')}</a>` })}</p>
      <${Consent} id="consent-gate" checked=${ok} onChange=${setOk} />
    </div>
  </${Sheet}>`;
}
