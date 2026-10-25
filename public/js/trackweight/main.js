import '/js/errors.js';
import { html, render } from '/js/ui.js';
import { App } from '/js/trackweight/app.js';
import { openDb } from '/js/trackweight/db.js';

const root = document.getElementById('root');

// the diary needs IndexedDB: say so plainly if the browser will not give it to us
openDb().then(
  () => render(html`<${App} />`, root),
  (e) => render(html`<main class="main narrow"><div class="callout"><b>Track Weight cannot save your diary here.</b><p class="small" style=${{ marginTop: '6px' }}>${e.message}</p></div></main>`, root)
);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
