/* ModaWard service worker.
   - Precaches the app shell so it opens instantly and works offline-first for static files.
   - Never caches /api, /uploads or /go: personal data and redirects always come from the network.
   Bump VERSION when shipping changes to cached files. */
const VERSION = 'mw-v5-1';
const SHELL = ['/', '/offline.html', '/css/app.css', '/js/main.js', '/js/app.js', '/vendor/ui.js', '/manifest.webmanifest', '/icons/icon.svg', '/fonts/instrument-serif-400.woff2', '/fonts/geist-latin.woff2'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/^\/(api|uploads|go|health|ready)(\/|$)/.test(url.pathname)) return;

  // page navigations: network first, fall back to the cached shell, then the offline page
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/').then((r) => r || caches.match('/offline.html'))));
    return;
  }

  // static assets: stale-while-revalidate
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      const fetching = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || fetching;
    })
  );
});
