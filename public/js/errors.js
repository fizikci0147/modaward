/**
 * Reports errors in the app's own code to the server (Business → System shows them), so problems
 * are found before anyone has to write in. Failed network requests, cancelled requests and errors
 * the screens already explain to the person (API errors) are not reported: they are not bugs.
 */
const BUILD = /\/v\/([^/]+)\//.exec(import.meta.url)?.[1] || '';
const NOISE = /ResizeObserver|Failed to fetch|Load failed|NetworkError|AbortError|The operation was aborted|Script error|network error|cancelled|canceled|Non-Error promise rejection/i;
const seen = new Set();
let count = 0;

export function reportError(err) {
  try {
    if (!err || err.status || err.name === 'AbortError') return;
    const message = String(err.message || err).slice(0, 300);
    if (NOISE.test(message) || seen.has(message) || count >= 5) return;
    seen.add(message);
    count += 1;
    fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'modaward' },
      body: JSON.stringify({ message, stack: String(err.stack || '').slice(0, 1500), path: location.pathname, build: BUILD }),
      keepalive: true
    }).catch(() => {});
  } catch {
    /* reporting must never cause an error of its own */
  }
}

addEventListener('error', (e) => reportError(e.error || e.message));
addEventListener('unhandledrejection', (e) => reportError(e.reason));
