/** Errors that are safe to show to API clients. Anything else becomes a generic 500. */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code    stable machine-readable code
   * @param {string} message human-readable, safe to display
   * @param {object} [details]
   * @param {{template:string, vars?:object, nested?:Record<string,{template:string,vars?:object}>}} [i18n]
   *   how to say it in another language: `template` (English, with {placeholders}) is looked up in the
   *   locale file; `nested` entries are translated first and slotted into the template.
   */
  constructor(status, code, message, details, i18n) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.i18n = i18n;
  }
}

export const badRequest = (message, details, i18n) => new HttpError(400, 'bad_request', message, details, i18n);
export const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to that.') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);
export const conflict = (message) => new HttpError(409, 'conflict', message);
export const tooMany = (message = 'Too many requests. Please slow down.') => new HttpError(429, 'rate_limited', message);
export const paymentRequired = (message, details, i18n) => new HttpError(402, 'upgrade_required', message, details, i18n);
export const unavailable = (message) => new HttpError(503, 'unavailable', message);

/** The message in the requester's language. `t` is req.t; without it the English message is returned. */
export function localizedMessage(err, t) {
  if (!t) return err.message;
  const spec = err.i18n;
  if (!spec) return t(err.message);
  const vars = { ...spec.vars };
  for (const [key, nested] of Object.entries(spec.nested ?? {})) vars[key] = t(nested.template, nested.vars);
  return t(spec.template, vars);
}
