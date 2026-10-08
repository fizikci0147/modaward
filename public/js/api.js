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

async function request(method, url, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method,
      credentials: 'same-origin',
      signal,
      headers: { 'X-Requested-With': 'modaward', 'X-Locale': getLocale(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
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
  return data;
}

export const api = {
  get: (url, opts) => request('GET', url, undefined, opts),
  post: (url, body = {}, opts) => request('POST', url, body, opts),
  put: (url, body = {}, opts) => request('PUT', url, body, opts),
  patch: (url, body = {}, opts) => request('PATCH', url, body, opts),
  del: (url, body, opts) => request('DELETE', url, body, opts)
};
