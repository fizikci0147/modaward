/* ModaWard service worker.
   - Precaches the app shell so it opens instantly and works offline-first for static files.
   - Never caches /api, /uploads or /go: personal data and redirects always come from the network.
   Bump VERSION when shipping changes to cached files. */
const VERSION = 'mw-v5-23-0';
const SHELL = ['/', '/offline.html', '/css/trackweight.css', '/js/trackweight/main.js', '/trackweight.webmanifest', '/css/app.css', '/js/main.js', '/js/app.js', '/vendor/ui.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/favicon.svg', '/fonts/instrument-serif-400.woff2', '/fonts/geist-latin.woff2'];

self.addEventListener('install', (event) => {
  // the calorie tracker page is a route, not a file, so it is cached by address (and never blocks the install)
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).then(() => c.add('/trackweight').catch(() => {}))).then(() => self.skipWaiting()));
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
    const tracker = /^\/trackweight\/?$/.test(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (tracker) {
            // keep the real page for offline use; a "members only" answer must never be kept, and removes an old copy
            const copy = res.ok ? res.clone() : null;
            caches.open(VERSION).then((c) => (copy ? c.put('/trackweight', copy) : res.status === 401 || res.status === 403 ? c.delete('/trackweight') : undefined));
          }
          return res;
        })
        .catch(() => caches.match(tracker ? '/trackweight' : '/').then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // Application code must stay mutually consistent across deploys, so it is network-first
  // (the server answers conditional requests with a cheap 304) and falls back to the cache offline.
  if (/^\/(js|css|shared|vendor)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest' || url.pathname === '/trackweight.webmanifest') {
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

// ── notifications (morning outfit, week ahead, forgotten pieces) ──
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'ModaWard', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'modaward',
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          w.navigate?.(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
