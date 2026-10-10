import { html, useState, useEffect } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { api } from '/js/api.js';
import { useStore, toast, fail } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { Switch, Spinner } from '/js/components/common.js';
import { hour12 } from '/js/format.js';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const keyBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function thisDevice() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

function Row({ title, hint, children }) {
  return html`<div class="spread rem-row"><div class="stack" style=${{ gap: '2px', minWidth: 0 }}><div class="label">${title}</div>${hint ? html`<div class="hint">${hint}</div>` : null}</div>${children}</div>`;
}

export function RemindersSection() {
  const { user } = useStore();
  const [s, setS] = useState(null); // { prefs, push, emailAvailable }
  const [device, setDevice] = useState(false); // this browser holds a push subscription
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const load = () => {
    setLoadError(null);
    api.get('/reminders').then(setS).catch(setLoadError);
  };
  useEffect(() => {
    load();
    thisDevice().then((sub) => setDevice(Boolean(sub))).catch(() => {});
  }, []);

  if (loadError) return html`<div class="card card-pad stack center"><p>${loadError.message}</p><div><button class="btn btn-outline" onClick=${load}>${t('Try again')}</button></div></div>`;
  if (!s) return html`<div class="skel" style=${{ height: '260px', borderRadius: '20px' }}></div>`;
  const { prefs } = s;

  const save = async (patch) => {
    setS((cur) => ({ ...cur, prefs: { ...cur.prefs, ...patch, daily: { ...cur.prefs.daily, ...patch.daily }, weekly: { ...cur.prefs.weekly, ...patch.weekly }, idle: { ...cur.prefs.idle, ...patch.idle } } }));
    try {
      setS(await api.put('/reminders', { ...patch, tz: timeZone() }));
    } catch (e) {
      fail(e);
      api.get('/reminders').then(setS).catch(() => {});
    }
  };

  const enableDevice = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast(t('Notifications are blocked for this site. Allow them in your browser settings, then try again.'), { kind: 'err', ms: 7000 });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(s.push.publicKey) }));
      setS(await api.post('/reminders/push/subscribe', sub.toJSON()));
      setDevice(true);
      if (!prefs.push) await save({ push: true });
      toast(t('Notifications are on for this device.'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const disableDevice = async () => {
    setBusy(true);
    try {
      const sub = await thisDevice();
      if (sub) {
        const { endpoint } = sub;
        await sub.unsubscribe();
        setS(await api.post('/reminders/push/unsubscribe', { endpoint }));
      }
      setDevice(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await api.post('/reminders/test', { kind: 'daily' });
      if (r.skipped) toast(t('Nothing to send yet. Set your location and add some pieces first.'), { kind: 'err' });
      else if (!r.delivered.push && !r.delivered.email) toast(t('There is nowhere to send it yet. Turn on notifications for this device, or email, below.'), { kind: 'err', ms: 6000 });
      else toast(t('Sent. It should arrive in a moment.'));
    } catch (e) {
      fail(e);
    } finally {
      setTesting(false);
    }
  };

  const canPush = s.push.available && supported();
  const needsInstall = isIos() && !installed();
  const anyOn = prefs.daily.on || prefs.weekly.on || prefs.idle.on;
  const anyChannel = (device && prefs.push) || (prefs.email && s.emailAvailable);

  return html`<section class="card section-card enter stack-l">
    <div class="stack" style=${{ gap: '6px' }}>
      <h2 class="display h-m">${t('Reminders')}</h2>
      <p class="muted small" style=${{ maxWidth: '60ch' }}>${t('A nudge when it is useful, never noise. Pick what you want and how to get it.')}</p>
    </div>

    <div class="stack">
      <${Row} title=${t('Morning outfit')} hint=${t('Today’s look, picked for the weather, at the time you choose')}>
        <${Switch} label=${t('Morning outfit')} checked=${prefs.daily.on} onChange=${(on) => save({ daily: { on } })} />
      </${Row}>
      ${prefs.daily.on
        ? html`<div class="row rem-time"><label class="small muted" for="rem-hour">${t('Send it at')}</label>
            <select id="rem-hour" class="select" style=${{ width: 'auto', minHeight: '38px' }} value=${prefs.daily.hour} onChange=${(e) => save({ daily: { hour: Number(e.target.value) } })}>
              ${Array.from({ length: 19 }, (_, i) => i + 4).map((h) => html`<option key=${h} value=${h}>${hour12(h)}</option>`)}
            </select></div>`
        : null}
      <${Row} title=${t('Week ahead')} hint=${t('Sunday evening: the forecast and a nudge to plan your week')}>
        <${Switch} label=${t('Week ahead')} checked=${prefs.weekly.on} onChange=${(on) => save({ weekly: { on } })} />
      </${Row}>
      <${Row} title=${t('Forgotten pieces')} hint=${t('Saturday morning, at most every two weeks: pieces you have not worn in a while')}>
        <${Switch} label=${t('Forgotten pieces')} checked=${prefs.idle.on} onChange=${(on) => save({ idle: { on } })} />
      </${Row}>
    </div>

    <div class="stack">
      <span class="eyebrow">${t('How to get them')}</span>
      ${canPush
        ? needsInstall
          ? html`<p class="small rem-tip"><${Icon} name="info" size="16" /><span>${t('On iPhone, add ModaWard to your Home Screen first (Share, then Add to Home Screen), then open it from there to turn notifications on.')}</span></p>`
          : html`<${Row} title=${t('Notifications on this device')} hint=${device ? t('This device will get your reminders.') : t('Appears like a message, even when the app is closed')}>
              ${busy ? html`<${Spinner} />` : html`<${Switch} label=${t('Notifications on this device')} checked=${device && prefs.push} onChange=${(on) => (on ? enableDevice() : disableDevice())} />`}
            </${Row}>`
        : html`<p class="small muted">${s.push.available ? t('This browser cannot show notifications.') : t('Notifications are not switched on for this site.')}</p>`}
      ${s.emailAvailable
        ? html`<${Row} title=${t('Email')} hint=${t('Sent to {email}. Every email has a one-tap unsubscribe.', { email: user.email })}>
            <${Switch} label=${t('Email')} checked=${prefs.email} onChange=${(email) => save({ email })} />
          </${Row}>`
        : null}
    </div>

    ${anyOn && !anyChannel ? html`<p class="small rem-tip"><${Icon} name="info" size="16" /><span>${t('Choose at least one way to get them above, or they will not reach you.')}</span></p>` : null}
    <div class="row-wrap" style=${{ alignItems: 'center' }}>
      <button class="btn btn-outline" onClick=${test} disabled=${testing}>${testing ? html`<${Spinner} />` : html`<${Icon} name="bell" />`}${t('Send me a test')}</button>
      <span class="small muted">${t('Times follow this device’s time zone.')}</span>
    </div>
  </section>`;
}
