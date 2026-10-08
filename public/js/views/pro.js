import { html, useState } from '/js/ui.js';
import { t, getLocale } from '/js/i18n.js';
import { L } from '/shared/i18n.js';
import { useStore, refreshMe, toast, fail } from '/js/store.js';
import { api } from '/js/api.js';
import { Icon } from '/js/icons.js';
import { Spinner, startCheckout, PRO_FEATURES } from '/js/components/common.js';
import { Link, navigate } from '/js/router.js';

const FREE = [L('Up to 30 pieces in your closet'), L('Outfits for today, matched to the hour-by-hour forecast'), L('3-day planning'), L('The style quiz and a taste profile that learns'), L('6 shopping looks at a time')];

function RedeemCode() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await api.post('/billing/redeem', { code });
      await refreshMe();
      toast(t('Pro is on until {date}. Enjoy!', { date: new Date(r.until * 1000).toLocaleDateString(getLocale()) }));
      setCode('');
    } catch (err) { fail(err); }
    setBusy(false);
  };
  return html`<form class="row center" style=${{ gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }} onSubmit=${submit}>
    <input class="input" style=${{ maxWidth: '240px' }} aria-label=${t('Pro code')} placeholder=${t('Have a Pro code?')} value=${code} maxlength="40" autocomplete="off" autocapitalize="characters" onInput=${(e) => setCode(e.target.value)} />
    <button class="btn btn-outline" disabled=${busy || !code.trim()}>${busy ? html`<${Spinner} />` : null}${t('Redeem')}</button>
  </form>`;
}

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
      <span class="eyebrow">${t('ModaWard Pro')}</span>
      <h1 class="display h-xl" style=${{ maxWidth: '16ch' }}>${t('A stylist in your')} <span class="italic">${t('pocket.')}</span></h1>
      <p class="muted" style=${{ maxWidth: '52ch' }}>${t('Everything in Free, without the limits, plus the full shopping feed and an AI stylist that writes you a note every day.')}</p>
      <div class="segmented" role="group" aria-label=${t('Billing period')}><button aria-pressed=${interval === 'month' ? 'true' : 'false'} onClick=${() => setInterval('month')}>${t('Monthly')}</button><button aria-pressed=${interval === 'year' ? 'true' : 'false'} onClick=${() => setInterval('year')}>${t('Yearly · save 38%')}</button></div>
    </header>
    <div class="plans enter enter-2">
      <section class="card plan">
        <div class="stack" style=${{ gap: '6px' }}><span class="eyebrow">${t('Free')}</span><div class="price-big">$0</div><p class="muted small">${t('Everything you need to fall in love with it.')}</p></div>
        <ul>${FREE.map((f) => html`<li key=${f}><${Icon} name="check" />${t(f)}</li>`)}</ul>
        ${user ? html`<button class="btn btn-outline" disabled>${pro ? t('Included') : t('Your current plan')}</button>` : html`<${Link} href="/register" class="btn btn-outline">${t('Get started free')}</${Link}>`}
      </section>
      <section class="card plan pro">
        <div class="stack" style=${{ gap: '6px' }}><span class="eyebrow" style=${{ color: 'inherit', opacity: 0.7 }}>${t('Pro')}</span><div class="price-big">${interval === 'year' ? '$59' : '$7.99'}<span class="small muted" style=${{ fontFamily: 'var(--font-ui)', letterSpacing: 0 }}> / ${interval === 'year' ? t('year') : t('month')}</span></div><p class="muted small">${interval === 'year' ? t('Just $4.92 a month.') : t('Cancel any time.')}</p></div>
        <ul>${PRO_FEATURES.map((f) => html`<li key=${f}><${Icon} name="check" />${t(f)}</li>`)}</ul>
        ${pro ? html`<button class="btn" style=${{ background: 'var(--bg)', color: 'var(--ink)' }} disabled>${t('You’re on Pro')}</button>` : capabilities.billing ? html`<button class="btn btn-l" style=${{ background: 'var(--bg)', color: 'var(--ink)' }} onClick=${buy} disabled=${busy}>${busy ? html`<${Spinner} />` : null}${t('Go Pro')}</button>` : html`<button class="btn" style=${{ background: 'var(--bg)', color: 'var(--ink)' }} disabled>${t('Coming soon')}</button>`}
      </section>
    </div>
    ${user && !pro ? html`<${RedeemCode} />` : null}
    <p class="footnote center">${t('Payments are handled securely by Stripe. Cancel any time from your profile; you keep Pro until the end of the period you paid for.')}</p>
  </div>`;
}
