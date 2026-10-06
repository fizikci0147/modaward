import { html, render } from '/js/ui.js';
import { App } from '/js/app.js';
import { toast } from '/js/store.js';

render(html`<${App} />`, document.getElementById('root'));

// Offline support and updates
if ('serviceWorker' in navigator) {
  addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('A new version is ready.', { ms: 12000, action: { label: 'Refresh', run: () => location.reload() } });
          }
        });
      });
    } catch {
      /* the app works fine without a service worker */
    }
  });
}
