/**
 * Checking the address of a store a person adds. Everything here is about not trusting the input: the address becomes
 * the target of links we sign and redirect to, so it must be a plain public https site, nothing that points inside a
 * network, carries a password, or hides another host. We never fetch it ourselves.
 */
import net from 'node:net';
import { badRequest } from '../util/errors.js';
import { RETAILERS } from './retailers.js';

const MAX_NAME = 40;

const stripWww = (host) => host.replace(/^www\./, '');

/** A hostname that is a real public site name: letters, digits, dashes and dots, with a proper ending. */
function validHost(host) {
  if (host.length > 253 || !host.includes('.')) return false;
  if (net.isIP(host) || host === 'localhost') return false;
  if (!/^[a-z0-9.-]+$/.test(host) || host.startsWith('.') || host.includes('..')) return false;
  const labels = host.split('.');
  if (labels.some((l) => !l || l.length > 63 || l.startsWith('-') || l.endsWith('-'))) return false;
  const tld = labels[labels.length - 1];
  if (!/^(?:[a-z]{2,24}|xn--[a-z0-9-]{2,20})$/.test(tld)) return false;
  // names that only exist inside a network
  return !/\.(local|localhost|internal|intranet|lan|home|corp|test|invalid|example)$/.test(host);
}

/** @returns {URL} a parsed https URL, or throws a friendly error */
function parseHttps(input) {
  let text = String(input ?? '').trim();
  if (!text || text.length > 300) throw badRequest('Enter a web address (up to 300 characters).');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
  let url;
  try {
    url = new URL(text);
  } catch {
    throw badRequest('That does not look like a web address. Try something like store.com.');
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw badRequest('Use an ordinary web address (https).');
  if (url.username || url.password) throw badRequest('Leave out any user name or password from the address.');
  if (url.port && url.port !== '443' && url.port !== '80') throw badRequest('Use the store’s normal web address, without a port number.');
  url.protocol = 'https:';
  url.port = '';
  if (!validHost(url.hostname)) throw badRequest('That does not look like a public store website. Try something like store.com.');
  return url;
}

/**
 * Validate what the person typed.
 * @param {{name: string, url: string, search?: string}} input
 * @returns {{name: string, domain: string, search: string|null}}
 */
export function checkStoreInput({ name, url, search }) {
  const cleanName = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanName) throw badRequest('Give the store a name.');
  if (cleanName.length > MAX_NAME) throw badRequest(`The name can be up to ${MAX_NAME} characters.`, undefined, { template: 'The name can be up to {max} characters.', vars: { max: MAX_NAME } });
  const domain = stripWww(parseHttps(url).hostname);
  let template = null;
  if (search !== undefined && search !== null && String(search).trim() !== '') {
    const text = String(search).trim();
    if (!text.includes('{q}')) throw badRequest('The search link needs {q} where the search words go, for example https://store.com/search?q={q}.');
    // check the host with a stand-in for the placeholder
    const probe = parseHttps(text.replaceAll('{q}', 'x'));
    const host = stripWww(probe.hostname);
    if (host !== domain && !host.endsWith(`.${domain}`)) throw badRequest('The search link has to be on the same website as the store.');
    template = text.startsWith('http') ? text.replace(/^http:/i, 'https:') : `https://${text}`;
  }
  return { name: cleanName, domain, search: template };
}

/** The built-in store that already has this website, if any. */
export const builtInFor = (domain) => RETAILERS.find((r) => stripWww(r.domain) === domain) ?? null;
