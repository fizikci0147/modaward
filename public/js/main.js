import '/js/errors.js';
import { html, render } from '/js/ui.js';
import { App } from '/js/app.js';
import { toast, set } from '/js/store.js';
import { loadLocale, detectLocale, getLocale, t } from '/js/i18n.js';

// load the language first so the very first paint is already translated
await loadLocale(detectLocale());
set({ locale: getLocale() });
render(html`<${App} />`, document.getElementById('root'));

// Offline support and updates
if ('serviceWorker' in navigator) {
  addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      // an installed app can stay open for days: look for a new release when it comes back to the front
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            toast(t('A new version is ready.'), { ms: 12000, action: { label: t('Refresh'), run: () => location.reload() } });
          }
        });
      });
    } catch {
      /* the app works fine without a service worker */
    }
  });
}
