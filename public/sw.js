/* ModaWard service worker.
   - Precaches the app shell so it opens instantly and works offline-first for static files.
   - Never caches /api, /uploads or /go: personal data and redirects always come from the network.
   Bump VERSION when shipping changes to cached files. */
const VERSION = 'mw-v5-2';
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

  // Application code must stay mutually consistent across deploys, so it is network-first
  // (the server answers conditional requests with a cheap 304) and falls back to the cache offline.
  if (/^\/(js|css|shared|vendor)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // fonts and icons never change in place: cache-first
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
  );
});
