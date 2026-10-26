import { html, useLayoutEffect, useRef } from '/js/ui.js';

const PATHS = {
  diary: '<path d="M6 4h11a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 17 21H6V4Z"/><path d="M6 4a1.5 1.5 0 0 0-1.5 1.5V19A2 2 0 0 0 6 21M9.5 8.5h6M9.5 12h6"/>',
  run: '<circle cx="14.5" cy="4.8" r="1.8"/><path d="m9.5 21 2.2-5.2-3-3 1.3-4.3 3.7-1.5 2.5 3.3 3.3.7M8 10.2 5.5 13M12.5 13.8l2.5 2.4 1 4.3"/>',
  chart: '<path d="M4 20V5M4 20h16"/><path d="m7.5 15 3.5-4 3 2.5 4.5-6"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-4 3.6-6 7.5-6s6.7 2 7.5 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  right: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.3-2h6.4l1.3 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.6"/>',
  barcode: '<path d="M4 6v12M7 6v12M11 6v12M14 6v12M17.5 6v12M20 6v12"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 7.5 3 3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8c0-.4.3-.8.8-.8h3.4c.5 0 .8.4.8.8V7M6.5 7l.8 12.2c0 .5.4.8.9.8h7.6c.5 0 .9-.3.9-.8L17.5 7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  sparkle: '<path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2L12 3.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  bowl: '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z"/><path d="M8 7.5c0-1.2 1-1.5 1-2.7M12 7.5c0-1.2 1-1.5 1-2.7M16 7.5c0-1.2 1-1.5 1-2.7"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  apple: '<path d="M12 7.5c-2-2-6-1.5-6 3.2 0 4.2 2.8 8.3 6 8.3s6-4.1 6-8.3c0-4.7-4-5.2-6-3.2Z"/><path d="M12 7.5c0-1.7.8-3 2.5-3.5"/>'
};

export function Icon({ name, size, class: cls = '' }) {
  return html`<svg class=${cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: PATHS[name] || '' }} />`;
}

/** A bottom sheet in the site's own style: Escape closes, focus moves in and is restored, the page behind stays put. */
export function Sheet({ title, onClose, children, footer }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // a layout effect: the key handler and the focus are in place before the first paint, so Escape works at once
  useLayoutEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
        if (!f.length) return e.preventDefault();
        if (!ref.current.contains(document.activeElement)) (e.preventDefault(), f[0].focus());
        else if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f[f.length - 1].focus());
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) (e.preventDefault(), f[0].focus());
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (ref.current?.querySelector('[data-autofocus]') || ref.current)?.focus?.();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (prev?.isConnected) prev.focus?.();
    };
  }, []);
  return html`<div class="scrim" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${title} tabindex="-1" ref=${ref}>
      <div class="grab"></div>
      <div class="sheet-head">
        <h2 class="display h-s">${title}</h2>
        <button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button>
      </div>
      <div class="sheet-body">${children}</div>
      ${footer ? html`<div class="sheet-foot">${footer}</div>` : null}
    </div>
  </div>`;
}

export const Spinner = () => html`<span class="spinner" role="progressbar" aria-label="Loading"></span>`;

/** Calories ring: the arc fills as the day's food approaches the budget and turns red past it. */
export function Ring({ value, max, children }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return html`<div class="tw-ring">
    <svg viewBox="0 0 132 132" role="img" aria-label=${`${Math.round(value)} of ${Math.round(max)} calories`}>
      <circle class="tw-ring-bg" cx="66" cy="66" r=${r} />
      <circle class=${`tw-ring-fg ${value > max ? 'over' : ''}`} cx="66" cy="66" r=${r} stroke-dasharray=${`${pct * c} ${c}`} transform="rotate(-90 66 66)" />
    </svg>
    <div class="tw-ring-label">${children}</div>
  </div>`;
}

export function MacroBar({ label, value, target, tone }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return html`<div class=${`tw-macro m-${tone}`}>
    <div class="small" style=${{ fontWeight: 650 }}>${label}</div>
    <div class="meter tw-meter"><i class=${`tone-${tone}`} style=${{ width: `${pct}%` }}></i></div>
    <div class="tiny faint num">${Math.round(value)} / ${target} g</div>
  </div>`;
}

export const kcalFmt = (n) => Math.round(n).toLocaleString();
/** Text field value to number ('' and junk become 0). */
export const num = (s) => (String(s).trim() === '' || Number.isNaN(Number(s)) ? 0 : Number(s));
