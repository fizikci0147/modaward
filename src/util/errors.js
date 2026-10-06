/** Errors that are safe to show to API clients. Anything else becomes a generic 500. */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code    stable machine-readable code
   * @param {string} message human-readable, safe to display
   * @param {object} [details]
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to that.') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);
export const conflict = (message) => new HttpError(409, 'conflict', message);
export const tooMany = (message = 'Too many requests. Please slow down.') => new HttpError(429, 'rate_limited', message);
export const paymentRequired = (message, details) => new HttpError(402, 'upgrade_required', message, details);
export const unavailable = (message) => new HttpError(503, 'unavailable', message);
