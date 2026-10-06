import { html, useEffect } from '/js/ui.js';
import { useStore, boot, set, toast, state } from '/js/store.js';
import { usePath, navigate, Link } from '/js/router.js';
import { Icon, Logo } from '/js/icons.js';
import { Toasts, UpgradeSheet, ProBadge } from '/js/components/common.js';
import { initials } from '/js/format.js';
import { TodayView } from '/js/views/today.js';
import { WeekView } from '/js/views/week.js';
import { ClosetView } from '/js/views/closet.js';
import { ShopView } from '/js/views/shop.js';
import { ProfileView } from '/js/views/profile.js';
import { AuthView } from '/js/views/auth.js';
import { WelcomeView } from '/js/views/welcome.js';
import { ProView } from '/js/views/pro.js';
import { PrivacyView, TermsView } from '/js/views/legal.js';

const NAV = [
  ['/', 'Today', 'sun-cloud'],
  ['/week', 'Week', 'calendar'],
  ['/closet', 'Closet', 'hanger'],
  ['/shop', 'Shop', 'bag'],
  ['/style', 'You', 'user']
];
const PUBLIC = new Set(['/login', '/register', '/forgot', '/reset', '/privacy', '/terms', '/pro']);
const TITLES = { '/': 'Today', '/week': 'The week ahead', '/closet': 'Your closet', '/shop': 'Shop', '/style': 'You', '/pro': 'Pro', '/privacy': 'Privacy', '/terms': 'Terms', '/login': 'Sign in', '/register': 'Create account', '/welcome': 'Welcome' };

function Splash() {
  return html`<div style=${{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><div class="brand" style=${{ fontSize: '30px', opacity: 0.9 }}><${Logo} size=${30} />ModaWard</div></div>`;
}

function Shell({ path, children }) {
  const { user, entitlements, installPrompt } = useStore();
  const pro = entitlements?.plan === 'pro';
  const install = async () => {
    const p = state.installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice.catch(() => {});
    set({ installPrompt: null });
  };
  const isCurrent = (href) => (href === '/' ? path === '/' : path.startsWith(href));
  return html`<div class="app">
    <nav class="rail" aria-label="Main">
      <${Link} href="/" class="brand"><${Logo} size=${28} />ModaWard</${Link}>
      ${NAV.map(([href, label, icon]) => html`<${Link} key=${href} href=${href} class="rail-link" aria-current=${isCurrent(href) ? 'page' : undefined}><${Icon} name=${icon} />${label}</${Link}>`)}
      <div class="rail-foot">
        ${!pro ? html`<${Link} href="/pro" class="btn btn-primary"><${Icon} name="crown" />Go Pro</${Link}>` : html`<div class="row" style=${{ padding: '0 12px' }}><${ProBadge} /><span class="small muted">Thank you</span></div>`}
        ${installPrompt ? html`<button class="btn btn-outline btn-s" onClick=${install}><${Icon} name="download" />Install app</button>` : null}
        <${Link} href="/style?section=account" class="row small muted" style=${{ padding: '8px 12px' }}><span class="badge" style=${{ width: '30px', height: '30px', justifyContent: 'center' }}>${initials(user?.name || user?.email)}</span><span class="grow" style=${{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${user?.name || user?.email}</span></${Link}>
      </div>
    </nav>
    <header class="topbar">
      <${Link} href="/" class="brand"><${Logo} size=${24} />ModaWard</${Link}>
      <div class="row">${!pro ? html`<${Link} href="/pro" class="chip chip-s" aria-label="Upgrade to Pro"><${Icon} name="crown" />Pro</${Link}>` : html`<${ProBadge} />`}</div>
    </header>
    <main class="main" id="main">${children}</main>
    <nav class="tabbar" aria-label="Main">
      ${NAV.map(([href, label, icon]) => html`<${Link} key=${href} href=${href} class="tab" aria-current=${isCurrent(href) ? 'page' : undefined}><${Icon} name=${icon} />${label}</${Link}>`)}
    </nav>
  </div>`;
}

function PublicPage({ children }) {
  const { user } = useStore();
  return html`<div style=${{ minHeight: '100dvh' }}>
    <header class="topbar" style=${{ position: 'static' }}><${Link} href=${user ? '/' : '/login'} class="brand"><${Logo} size=${24} />ModaWard</${Link}><${Link} href=${user ? '/' : '/login'} class="btn btn-ghost btn-s">${user ? 'Open app' : 'Sign in'}</${Link}></header>
    <main class="main" style=${{ paddingBottom: '80px' }}>${children}</main>
  </div>`;
}

export function App() {
  const { ready, user } = useStore();
  const path = usePath();

  useEffect(() => {
    boot();
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      set({ installPrompt: e });
    });
    addEventListener('appinstalled', () => set({ installPrompt: null }));
    addEventListener('offline', () => toast('You are offline. Some things may not load.', { kind: 'err' }));
  }, []);

  useEffect(() => {
    document.title = `${TITLES[path] || 'ModaWard'} · ModaWard`;
  }, [path]);

  // route guards
  useEffect(() => {
    if (!ready) return;
    // read the live location: `path` can be stale if a view navigated while this effect was queued
    const here = location.pathname.replace(/\/+$/, '') || '/';
    if (!user && !PUBLIC.has(here)) navigate('/login', { replace: true });
    else if (user && ['/login', '/register', '/forgot'].includes(here)) navigate('/', { replace: true });
  }, [ready, user, path]);

  if (!ready) return html`<${Splash} />`;

  let page;
  if (path === '/login') page = html`<${AuthView} mode="login" />`;
  else if (path === '/register') page = html`<${AuthView} mode="register" />`;
  else if (path === '/forgot') page = html`<${AuthView} mode="forgot" />`;
  else if (path === '/reset') page = html`<${AuthView} mode="reset" />`;
  else if (path === '/privacy') page = html`<${PublicPage}><${PrivacyView} /></${PublicPage}>`;
  else if (path === '/terms') page = html`<${PublicPage}><${TermsView} /></${PublicPage}>`;
  else if (!user) page = html`<${Splash} />`;
  else if (path === '/welcome') page = html`<${WelcomeView} />`;
  else if (path === '/pro') page = html`<${Shell} path=${path}><${ProView} /></${Shell}>`;
  else {
    const view = { '/': TodayView, '/week': WeekView, '/closet': ClosetView, '/shop': ShopView, '/style': ProfileView }[path];
    page = view
      ? html`<${Shell} path=${path}><${view} /></${Shell}>`
      : html`<${Shell} path=${path}><div class="empty"><h1 class="display h-l">Nothing here</h1><${Link} href="/" class="btn btn-primary">Back to today</${Link}></div></${Shell}>`;
  }

  return html`<a class="sr-only" href="#main">Skip to content</a>${page}<${UpgradeSheet} /><${Toasts} />`;
}
