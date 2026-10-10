import { useEffect, useReducer } from '/js/ui.js';
import { api, onApiEvent } from '/js/api.js';
import { navigate } from '/js/router.js';
import { completeness } from '/shared/profile.js';
import { loadLocale, getLocale, t } from '/js/i18n.js';

/**
 * Tiny global store. State is one plain object; any change re-renders subscribed components.
 * The app is small enough that selector-level optimisation would be noise.
 */
export const state = {
  ready: false,
  user: null,
  profile: null,
  entitlements: null,
  capabilities: {},
  garments: null, // null = not loaded yet
  toasts: [],
  upgrade: null, // { reason, message } while the upgrade sheet is open
  installPrompt: null,
  locale: 'en', // bumps re-renders when the language changes
  legal: null, // { version, accepted }: has this person accepted the current Terms and Privacy Policy
  bootError: false, // the server could not be reached when the app opened (not the same as signed out)
  app: null // { version, build } of the server this page is talking to
};

const subs = new Set();
export function set(patch) {
  Object.assign(state, patch);
  subs.forEach((fn) => fn());
}

export function useStore() {
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    subs.add(bump);
    return () => subs.delete(bump);
  }, []);
  return state;
}

let toastId = 0;
export function toast(message, { kind = 'ok', action, ms = 3600 } = {}) {
  const id = ++toastId;
  set({ toasts: [...state.toasts, { id, message, kind, action }] });
  setTimeout(() => set({ toasts: state.toasts.filter((t) => t.id !== id) }), ms);
}
export const dismissToast = (id) => set({ toasts: state.toasts.filter((t) => t.id !== id) });

/** Show a friendly error toast and, for plan limits, the upgrade sheet. */
export function fail(err) {
  if (err?.code === 'upgrade_required') return; // the global handler opens the sheet
  if (err?.name === 'AbortError') return;
  toast(err?.message || t('Something went wrong.'), { kind: 'err', ms: 5000 });
}

export const openUpgrade = (reason = 'pro', message = '') => set({ upgrade: { reason, message } });
export const closeUpgrade = () => set({ upgrade: null });

onApiEvent((type, err) => {
  if (type === 'unauthorized' && state.user) {
    set({ user: null, profile: null, garments: null, entitlements: null });
    navigate('/login', { replace: true });
  }
  if (type === 'upgrade') openUpgrade(err.details?.feature || 'pro', err.message);
});

async function applyMe(me) {
  // a saved language on the account wins over this browser's guess
  const saved = me.profile?.locale;
  if (saved && saved !== getLocale()) await loadLocale(saved);
  set({ user: me.user, profile: me.profile, entitlements: me.entitlements, capabilities: me.capabilities || {}, locale: getLocale(), app: me.app || null, legal: me.legal || null });
}

/** Switch language now, remember it in this browser and, when signed in, on the account. */
export async function setLocale(code) {
  const used = await loadLocale(code);
  set({ locale: used });
  if (state.user && state.profile?.locale !== used) {
    set({ profile: { ...state.profile, locale: used } });
    api.patch('/profile', { locale: used }).catch(() => {});
  }
}

/** Tell the server which time zone this device is in, so reminders keep arriving at the right local hour. */
function syncTimeZone() {
  if (!state.user) return;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) api.put('/reminders/timezone', { tz }).catch(() => {});
  } catch {
    /* no Intl time zone: keep what is stored */
  }
}

export async function boot() {
  try {
    await applyMe(await api.get('/auth/me'));
    set({ bootError: false });
    syncTimeZone();
  } catch (e) {
    // Signed out answers normally, so a failure here means the server was unreachable: say so and
    // offer a retry instead of sending a signed-in person to the login screen.
    set({ bootError: e?.name !== 'AbortError' });
  }
  set({ ready: true });
}

export async function authenticate(kind, body) {
  const me = await api.post(`/auth/${kind}`, body);
  await applyMe(me);
  set({ garments: null });
  return me;
}

/** Stop this device receiving the account's reminders (it may be handed to someone else). */
export async function forgetThisDevice() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await api.post('/reminders/push/unsubscribe', { endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch {
    /* best effort: the server also drops subscriptions that stop working */
  }
}

export async function logout() {
  await forgetThisDevice();
  await api.post('/auth/logout').catch(() => {});
  set({ user: null, profile: null, garments: null, entitlements: null });
  navigate('/login', { replace: true });
}

/** Record that the signed-in person accepted the current Terms and Privacy Policy. */
export async function acceptTerms() {
  const me = await api.post('/auth/accept-terms', { accept: true });
  set({ legal: me.legal || null });
}

export async function refreshMe() {
  await applyMe(await api.get('/auth/me'));
}

export async function loadCloset(force = false) {
  if (state.garments && !force) return state.garments;
  const { garments } = await api.get('/garments');
  set({ garments });
  return garments;
}

export function upsertGarment(g) {
  const list = state.garments || [];
  const i = list.findIndex((x) => x.id === g.id);
  set({ garments: i >= 0 ? list.map((x) => (x.id === g.id ? g : x)) : [g, ...list] });
}
export const removeGarment = (id) => set({ garments: (state.garments || []).filter((g) => g.id !== id) });

let patchTimer;
let pending = {};
let inflight = 0;
const mergeDeep = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a?.[k] && typeof a[k] === 'object' ? mergeDeep(a[k], v) : v;
  return out;
};

/** Optimistic, debounced profile update. Resolves once the server has stored it. */
let waiters = [];
export function updateProfile(patch, { immediate = false, quiet = false } = {}) {
  set({ profile: mergeDeep(state.profile, patch) });
  pending = mergeDeep(pending, patch);
  clearTimeout(patchTimer);
  return new Promise((resolve, reject) => {
    // every caller whose change is folded into this request hears how it went, not just the last one
    waiters.push({ resolve, reject });
    const send = async () => {
      const body = pending;
      const mine = waiters;
      pending = {};
      waiters = [];
      inflight += 1;
      try {
        const res = await api.patch('/profile', body);
        inflight -= 1;
        // edits made while this request was out are newer than its answer: keep them on top
        set({ profile: inflight > 0 || Object.keys(pending).length ? mergeDeep(res.profile, pending) : res.profile });
        if (!quiet) toast(t('Saved'));
        mine.forEach((w) => w.resolve(res));
      } catch (e) {
        if (inflight > 0) inflight -= 1;
        fail(e);
        try {
          set({ profile: (await api.get('/profile')).profile });
        } catch {
          /* keep optimistic state */
        }
        mine.forEach((w) => w.reject(e));
      }
    };
    if (immediate) send();
    else patchTimer = setTimeout(send, 600);
  });
}

export const profileCompleteness = () => (state.profile ? completeness(state.profile) : { percent: 0, next: [] });
