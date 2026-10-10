/**
 * Tiny schema validator. Every API payload goes through one of these before touching the
 * database, so handlers only ever see well-typed, bounded data.
 *
 *   const v = object({ name: string({ max: 80 }), age: optional(integer({ min: 0 })) });
 *   const clean = v(input);   // throws HttpError(400) with a precise path on failure
 */
import { badRequest } from './errors.js';

const fillIn = (text, vars) => text.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole));

/** `reason` is an English template with {placeholders}; it is rendered now and translatable later. */
const fail = (path, reason, vars = {}) => {
  throw badRequest(`${path || 'value'}: ${fillIn(reason, vars)}`, { field: path }, { template: '{field}: {reason}', vars: { field: path || 'value' }, nested: { reason: { template: reason, vars } } });
};

const rangeReason = (min, max) =>
  Number.isFinite(min) && Number.isFinite(max) ? ['must be between {min} and {max}', { min, max }] : Number.isFinite(min) ? ['must be at least {min}', { min }] : ['must be at most {max}', { max }];

export const string =
  ({ min = 0, max = 500, trim = true, pattern, patternMessage } = {}) =>
  (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
    if (typeof v !== 'string') fail(path, 'must be text');
    const s = trim ? v.trim() : v;
    if (s.length < min) (min === 1 ? fail(path, 'is required') : fail(path, 'must be at least {min} characters', { min }));
    if (s.length > max) fail(path, 'must be at most {max} characters', { max });
    if (pattern && !pattern.test(s)) fail(path, patternMessage || 'has an invalid format');
    // strip control characters other than newline/tab
    // eslint-disable-next-line no-control-regex
    return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  };

export const integer =
  ({ min = -Infinity, max = Infinity } = {}) =>
  (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
    if (typeof v === 'string' && /^-?\d+$/.test(v)) v = Number(v);
    if (!Number.isInteger(v)) fail(path, 'must be a whole number');
    if (v < min || v > max) fail(path, ...rangeReason(min, max));
    return v;
  };

export const number =
  ({ min = -Infinity, max = Infinity, step } = {}) =>
  (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) v = Number(v);
    if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'must be a number');
    if (v < min || v > max) fail(path, ...rangeReason(min, max));
    return step ? Math.round(v / step) * step : v;
  };

export const boolean = () => (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
  if (v === true || v === 'true' || v === 1) return true;
  if (v === false || v === 'false' || v === 0) return false;
  return fail(path, 'must be true or false');
};

export const oneOf =
  (values) =>
  (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
    if (!values.includes(v)) fail(path, 'must be one of: {values}', { values: values.join(', ') });
    return v;
  };

export const hexColor = () => (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) fail(path, 'must be a hex colour like #1f2f54');
  return v.toLowerCase();
};

export const email = () => (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
  const s = string({ min: 3, max: 254 })(v, path).toLowerCase();
  // no list separators, quotes or brackets: an address must name exactly one mailbox
  if (!/^[^\s@,;:<>"()[\]\\]+@[^\s@,;:<>"()[\]\\]+\.[^\s@,;:<>"()[\]\\]{2,}$/.test(s)) fail(path, 'must be a valid email address');
  return s;
};

export const arrayOf =
  (item, { max = 100, min = 0, unique = false } = {}) =>
  (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
    if (!Array.isArray(v)) fail(path, 'must be a list');
    if (v.length > max) fail(path, 'must have at most {max} items', { max });
    if (v.length < min) fail(path, 'must have at least {min} items', { min });
    const out = v.map((x, i) => item(x, `${path}[${i}]`));
    return unique ? [...new Set(out)] : out;
  };

export const optional =
  (inner, fallback) =>
  (v, path = '') =>
    v === undefined || v === null || v === '' ? fallback : inner(v, path);

/**
 * @param {Record<string, (v: any, path?: string) => any>} shape
 * @param {{ allowUnknown?: boolean }} [opts]
 */
export const object =
  (shape, { allowUnknown = false } = {}) =>
  (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
    if (v === null || typeof v !== 'object' || Array.isArray(v)) fail(path, 'must be an object');
    const out = {};
    for (const [key, check] of Object.entries(shape)) {
      const value = check(v[key], path ? `${path}.${key}` : key);
      if (value !== undefined) out[key] = value;
    }
    if (!allowUnknown) {
      for (const key of Object.keys(v)) if (!(key in shape)) fail(path ? `${path}.${key}` : key, 'is not an allowed field');
    }
    return out;
  };

/** Record with bounded keys and values: `{ minimal: 0.8, classic: 0.4 }` */
export const record =
  (keyCheck, valueCheck, { max = 50 } = {}) =>
  (v, path = '') => {
    if (v === undefined || v === null) fail(path, 'is required');
    if (v === null || typeof v !== 'object' || Array.isArray(v)) fail(path, 'must be an object');
    const keys = Object.keys(v);
    if (keys.length > max) fail(path, 'must have at most {max} entries', { max });
    const out = {};
    for (const k of keys) out[keyCheck(k, `${path}.${k}`)] = valueCheck(v[k], `${path}.${k}`);
    return out;
  };

/** Marks a validator as accepting an explicit `null` (used by `partial` to allow clearing a field). */
export const nullable = (inner) => Object.assign((v, path = '') => (v === null ? null : inner(v, path)), { allowNull: true });

/** Like `object`, but every field is optional: only the provided ones are returned (PATCH bodies). */
export const partial =
  (shape, opts) =>
  (v, path = '') =>
    object(
      Object.fromEntries(
        Object.entries(shape).map(([k, check]) => [
          k,
          Object.assign((x, p = '') => (x === undefined ? undefined : x === null && !check.allowNull ? undefined : check(x, p)), { allowNull: true })
        ])
      ),
      opts
    )(v, path);
