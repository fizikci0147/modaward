import crypto from 'node:crypto';
import { HttpError, forbidden, tooMany, unauthorized, paymentRequired, localizedMessage } from '../util/errors.js';

/** Request id + access log line (no query strings, no PII). */
export function requestContext(log) {
  return (req, res, next) => {
    req.id = crypto.randomBytes(6).toString('hex');
    const start = process.hrtime.bigint();
    res.setHeader('X-Request-Id', req.id);
    res.on('finish', () => {
      if (req.path === '/health') return;
      log.info('http', {
        id: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
        user: req.user?.id
      });
    });
    next();
  };
}

/**
 * Strict security headers. The frontend has no inline scripts or styles, so the CSP can forbid
 * both. Product photos from retailer feeds are the only reason `img-src` allows https.
 */
export function securityHeaders(config) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=(), payment=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (req.secure || config.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

/**
 * CSRF defence for state-changing API calls:
 *  1. a custom header that cross-site forms cannot set and CORS (which we never enable) would
 *     have to pre-approve, and
 *  2. if the browser sent an Origin, it must be this site (or an explicitly allowed one).
 * Cookies are SameSite=Lax as a third layer.
 */
export function csrf(config) {
  const unsafe = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  return (req, _res, next) => {
    if (!unsafe.has(req.method)) return next();
    if (req.get('x-requested-with') !== 'modaward') return next(forbidden('Missing request header.'));
    const origin = req.get('origin');
    if (origin && origin !== 'null') {
      let host;
      try {
        host = new URL(origin).host.toLowerCase();
      } catch {
        return next(forbidden('Invalid origin.'));
      }
      const own = [req.get('host'), req.get('x-forwarded-host')?.split(',')[0].trim()].filter(Boolean).map((h) => h.toLowerCase());
      const appHost = config.appUrl ? new URL(config.appUrl).host.toLowerCase() : null;
      const allowed = config.allowedOrigins.some((o) => o === origin.toLowerCase() || o === host);
      if (!own.includes(host) && host !== appHost && !allowed) return next(forbidden('Request origin is not allowed.'));
    }
    next();
  };
}

/**
 * The part of an address a limiter should count. An IPv6 customer owns a whole /64, so counting
 * the full address would let one person rotate through billions of "different" clients.
 */
export function clientKey(ip) {
  const s = String(ip || '');
  if (!s.includes(':') || /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(s)) return s.replace(/^::ffff:/i, '');
  const [head, tail = ''] = s.split('::');
  const a = head ? head.split(':') : [];
  const b = tail ? tail.split(':') : [];
  const groups = s.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/**
 * Fixed-window in-memory limiter. Per-process, which is right for a single Node instance.
 * `onLimit(req, res)` can answer a capped request itself (instead of an error) when the error
 * would reveal something.
 */
export function rateLimit({ windowMs, max, key = (req) => clientKey(req.ip), message, now = () => Date.now(), onLimit }) {
  const hits = new Map();
  return (req, res, next) => {
    const k = key(req);
    const t = now();
    let b = hits.get(k);
    if (!b || t - b.start >= windowMs) {
      b = { start: t, n: 0 };
      hits.set(k, b);
    }
    b.n += 1;
    if (hits.size > 20_000) for (const [id, v] of hits) if (t - v.start >= windowMs) hits.delete(id);
    if (b.n > max) {
      if (onLimit) return onLimit(req, res, next);
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (t - b.start)) / 1000)));
      return next(tooMany(message));
    }
    next();
  };
}

export const COOKIE = 'mw_session';

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null; // a malformed cookie is simply "no cookie", never a server error
      }
    }
  }
  return '';
}

/** Resolve the session cookie to `req.user` (row) and `req.sessionToken`. Never throws. */
export function sessionAuth(repos) {
  const lastHour = new Map(); // userId -> hour already recorded, so most requests do no database write
  return (req, _res, next) => {
    const token = readCookie(req, COOKIE);
    if (token) {
      const row = repos.sessions.resolve(token);
      if (row) {
        req.user = row;
        req.sessionToken = token;
        // "last seen" feeds the activity numbers; refresh at most every 10 minutes
        if (!row.last_seen_at || Date.now() / 1000 - row.last_seen_at > 600) repos.users.touch(row.id);
        const hour = Math.floor(Date.now() / 3_600_000);
        if (lastHour.get(row.id) !== hour) {
          repos.users.recordActivity(row.id);
          lastHour.set(row.id, hour);
          if (lastHour.size > 20_000) lastHour.clear();
        }
      }
    }
    next();
  };
}

export const requireUser = (req, _res, next) => (req.user ? next() : next(unauthorized()));

export const requirePro = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.plan !== 'pro') return next(paymentRequired('This is a ModaWard Pro feature.', { feature: 'pro' }));
  next();
};

export function setSessionCookie(req, res, token, days) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: Boolean(req.secure || req.app.locals.production), path: '/', maxAge: days * 86_400_000 });
}

export const clearSessionCookie = (req, res) => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: Boolean(req.secure || req.app.locals.production), path: '/' });

/** Last-resort error handler: stable JSON shape, no internals leaked. */
export function errorHandler(log) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    let status = 500;
    const tr = req.t ?? ((x) => x);
    let body = { error: { code: 'internal_error', message: tr('Something went wrong on our side. Please try again.') } };
    if (err instanceof HttpError) {
      status = err.status;
      body = { error: { code: err.code, message: localizedMessage(err, req.t), ...(err.details ? { details: err.details } : {}) } };
    } else if (err?.type === 'entity.too.large') {
      status = 413;
      body = { error: { code: 'too_large', message: tr('That upload is too large.') } };
    } else if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      status = 400;
      body = { error: { code: 'bad_json', message: tr('The request body was not valid JSON.') } };
    } else {
      log.error('http.error', { id: req.id, path: req.path, message: err?.message, stack: err?.stack?.split('\n').slice(0, 4).join(' | ') });
    }
    if (res.headersSent) return res.end();
    res.status(status).json({ ...body, requestId: req.id });
  };
}
