/**
 * API client. Every call carries the CSRF header, cookies travel automatically, and failures
 * become `ApiError`s with a stable code the UI can branch on (e.g. `upgrade_required`).
 */
import { t, getLocale } from '/js/i18n.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const listeners = new Set();
/** Subscribe to global API events: 'unauthorized' and 'upgrade'. */
export const onApiEvent = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = (type, payload) => listeners.forEach((fn) => fn(type, payload));

// generous: photo analysis and the AI stylist can legitimately take over a minute
const TIMEOUT_MS = 120_000;

/** The caller's signal and a time limit, whichever comes first (a request must never hang forever). */
function withTimeout(signal) {
  try {
    const limit = AbortSignal.timeout(TIMEOUT_MS);
    return signal ? AbortSignal.any([signal, limit]) : limit;
  } catch {
    return signal; // older browsers: no combined signal, the caller's still works
  }
}

async function request(method, url, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method,
      credentials: 'same-origin',
      signal: withTimeout(signal),
      headers: { 'X-Requested-With': 'modaward', 'X-Locale': getLocale(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    if (e.name === 'AbortError' && signal?.aborted) throw e; // the caller cancelled it on purpose
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new ApiError(0, 'timeout', t('Something went wrong. Please try again.'));
    throw new ApiError(0, 'offline', t('You appear to be offline. Check your connection and try again.'));
  }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const err = data?.error || {};
    const e = new ApiError(res.status, err.code || 'error', err.message || t('Something went wrong. Please try again.'), err.details);
    if (res.status === 401 && !url.startsWith('/auth/')) emit('unauthorized');
    if (res.status === 402) emit('upgrade', e);
    throw e;
  }
  // a success that is not JSON is a captive portal or a broken proxy, not our server
  if (data === null && res.status !== 204) throw new ApiError(res.status, 'bad_response', t('Something went wrong. Please try again.'));
  return data;
}

export const api = {
  get: (url, opts) => request('GET', url, undefined, opts),
  post: (url, body = {}, opts) => request('POST', url, body, opts),
  put: (url, body = {}, opts) => request('PUT', url, body, opts),
  patch: (url, body = {}, opts) => request('PATCH', url, body, opts),
  del: (url, body, opts) => request('DELETE', url, body, opts)
};
