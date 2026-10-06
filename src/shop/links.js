/**
 * Signed outbound links.
 *
 * Every "shop this" button points at `/go?...` on our own domain. The server verifies an HMAC
 * signature, logs the click (the data behind affiliate revenue reporting), applies the current
 * affiliate template, and redirects. Because the signature covers the destination, `/go`
 * cannot be abused as an open redirect.
 */
import { hmac, safeEqual } from '../services/secrets.js';
import { retailerById, affiliateUrl, hostOf } from './retailers.js';

export function createLinker({ secret, affiliates = {} }) {
  const sign = (retailerId, url, kind) => hmac(secret, `${retailerId}|${kind}|${url}`);

  return {
    /** @returns {string} a relative `/go` URL */
    link(retailerId, url, kind = 'search') {
      const q = new URLSearchParams({ r: retailerId, k: kind, u: url, s: sign(retailerId, url, kind) });
      return `/go?${q}`;
    },

    /**
     * Validate a `/go` request.
     * @returns {{retailer:object, destination:string, kind:string}|null}
     */
    verify(query) {
      const { r, k, u, s } = query;
      if (![r, k, u, s].every((v) => typeof v === 'string')) return null;
      if (!safeEqual(sign(r, u, k), s)) return null;
      const retailer = retailerById(r);
      if (!retailer) return null;
      let parsed;
      try {
        parsed = new URL(u);
      } catch {
        return null;
      }
      if (parsed.protocol !== 'https:') return null;
      const host = hostOf(u);
      const allowed = host === retailer.domain || host.endsWith(`.${retailer.domain}`) || host === 'www.google.com';
      if (!allowed) return null;
      return { retailer, destination: affiliateUrl(affiliates, r, u, k), kind: k, host };
    }
  };
}
