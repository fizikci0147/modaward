/**
 * The public base URL used in emails and payment return links. In production it must come from
 * APP_URL: the Host header is attacker-controlled and must never end up in a password-reset link.
 */
export function baseUrl(config, req) {
  if (config.appUrl) return config.appUrl;
  if (config.production) return null;
  return `${req.protocol}://${req.get('host')}`;
}
