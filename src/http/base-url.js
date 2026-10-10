/**
 * The public base URL used in emails and payment return links. In production it must come from
 * APP_URL: the Host header is attacker-controlled and must never end up in a password-reset link.
 */
export function baseUrl(config, req) {
  if (config.appUrl) return config.appUrl;
  if (config.production) return null;
  // convenience for local development only: never echo an arbitrary Host header, even when
  // NODE_ENV was left unset on a real server
  const host = req.get('host') || '';
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.test(host) ? `${req.protocol}://${host}` : null;
}
