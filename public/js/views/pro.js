import { html, useState } from '/js/ui.js';
import { useStore } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { Spinner, startCheckout, PRO_FEATURES } from '/js/components/common.js';
import { Link, navigate } from '/js/router.js';

const FREE = ['Up to 30 pieces in your closet', 'Outfits for today, matched to the hour-by-hour forecast', '3-day planning', 'The style quiz and a taste profile that learns', '6 shopping looks at a time'];

export function ProView() {
  const { user, entitlements, capabilities } = useStore();
  const [interval, setInterval] = useState('year');
  const [busy, setBusy] = useState(false);
  const pro = entitlements?.plan === 'pro';
  const buy = async () => {
    if (!user) return navigate('/register');
    setBusy(true);
    try { await startCheckout(interval); } catch { setBusy(false); }
  };
  return html`<div class="stack-l">
    <header class="stack center enter" style=${{ gap: '12px', justifyItems: 'center' }}>
      <span class="eyebrow">ModaWard Pro</span>
      <h1 class="display h-xl" style=${{ maxWidth: '16ch' }}>A stylist in your <span class="italic">pocket.</span></h1>
      <p class="muted" style=${{ maxWidth: '52ch' }}>Everything in Free, without the limits, plus the full shopping feed and an AI stylist that writes you a note every day.</p>
      <div class="segmented" role="group" aria-label="Billing period"><button aria-pressed=${interval === 'month' ? 'true' : 'false'} onClick=${() => setInterval('month')}>Monthly</button><button aria-pressed=${interval === 'year' ? 'true' : 'false'} onClick=${() => setInterval('year')}>Yearly · save 38%</button></div>
    </header>
    <div class="plans enter enter-2">
      <section class="card plan">
        <div class="stack" style=${{ gap: '6px' }}><span class="eyebrow">Free</span><div class="price-big">$0</div><p class="muted small">Everything you need to fall in love with it.</p></div>
        <ul>${FREE.map((f) => html`<li key=${f}><${Icon} name="check" />${f}</li>`)}</ul>
        ${user ? html`<button class="btn btn-outline" disabled>${pro ? 'Included' : 'Your current plan'}</button>` : html`<${Link} href="/register" class="btn btn-outline">Get started free</${Link}>`}
      </section>
      <section class="card plan pro">
        <div class="stack" style=${{ gap: '6px' }}><span class="eyebrow" style=${{ color: 'inherit', opacity: 0.7 }}>Pro</span><div class="price-big">${interval === 'year' ? '$59' : '$7.99'}<span class="small muted" style=${{ fontFamily: 'var(--font-ui)', letterSpacing: 0 }}> / ${interval === 'year' ? 'year' : 'month'}</span></div><p class="muted small">${interval === 'year' ? 'Just $4.92 a month.' : 'Cancel any time.'}</p></div>
        <ul>${PRO_FEATURES.map((f) => html`<li key=${f}><${Icon} name="check" />${f}</li>`)}</ul>
        ${pro ? html`<button class="btn" style=${{ background: 'var(--bg)', color: 'var(--ink)' }} disabled>You’re on Pro</button>` : capabilities.billing ? html`<button class="btn btn-l" style=${{ background: 'var(--bg)', color: 'var(--ink)' }} onClick=${buy} disabled=${busy}>${busy ? html`<${Spinner} />` : null}Go Pro</button>` : html`<button class="btn" style=${{ background: 'var(--bg)', color: 'var(--ink)' }} disabled>Coming soon</button>`}
      </section>
    </div>
    <p class="footnote center">Payments are handled securely by Stripe. Cancel any time from your profile; you keep Pro until the end of the period you paid for.</p>
  </div>`;
}
