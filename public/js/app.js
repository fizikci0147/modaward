import { html, useEffect, useErrorBoundary, useRef } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { L } from '/shared/i18n.js';
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
import { UnsubscribeView } from '/js/views/unsubscribe.js';
import { reportError } from '/js/errors.js';
import { TripView } from '/js/views/trip.js';
import { AdminView } from '/js/views/admin.js';

const NAV = [
  ['/', L('Today'), 'sun-cloud'],
  ['/week', L('Week'), 'calendar'],
  ['/closet', L('Closet'), 'hanger'],
  ['/shop', L('Shop'), 'bag'],
  ['/style', L('You'), 'user']
];
const PUBLIC = new Set(['/login', '/register', '/forgot', '/reset', '/privacy', '/terms', '/pro', '/unsubscribe']);
const TITLES = { '/': L('Today'), '/week': L('The week ahead'), '/closet': L('Your closet'), '/shop': L('Shop'), '/style': L('You'), '/pro': L('Pro'), '/privacy': L('Privacy'), '/terms': L('Terms'), '/login': L('Sign in'), '/register': L('Create account'), '/welcome': L('Welcome'), '/admin': L('Business'), '/trip': L('Pack for a trip') };

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
    <nav class="rail" aria-label=${t('Main')}>
      <${Link} href="/" class="brand"><${Logo} size=${28} />ModaWard</${Link}>
      ${NAV.map(([href, label, icon]) => html`<${Link} key=${href} href=${href} class="rail-link" aria-current=${isCurrent(href) ? 'page' : undefined}><${Icon} name=${icon} />${t(label)}</${Link}>`)}
      ${user?.isAdmin ? html`<${Link} href="/admin" class="rail-link" aria-current=${isCurrent('/admin') ? 'page' : undefined}><${Icon} name="shield" />${t('Business')}</${Link}>` : null}
      <div class="rail-foot">
        ${!pro ? html`<${Link} href="/pro" class="btn btn-primary"><${Icon} name="crown" />${t('Go Pro')}</${Link}>` : html`<div class="row" style=${{ padding: '0 12px' }}><${ProBadge} /><span class="small muted">${t('Thank you')}</span></div>`}
        ${installPrompt ? html`<button class="btn btn-outline btn-s" onClick=${install}><${Icon} name="download" />${t('Install app')}</button>` : null}
        <${Link} href="/style?section=account" class="row small muted" style=${{ padding: '8px 12px' }}><span class="badge" style=${{ width: '30px', height: '30px', justifyContent: 'center' }}>${initials(user?.name || user?.email)}</span><span class="grow" style=${{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${user?.name || user?.email}</span></${Link}>
      </div>
    </nav>
    <header class="topbar">
      <${Link} href="/" class="brand"><${Logo} size=${24} />ModaWard</${Link}>
      <div class="row">${!pro ? html`<${Link} href="/pro" class="chip chip-s" aria-label=${t('Upgrade to Pro')}><${Icon} name="crown" />${t('Pro')}</${Link}>` : html`<${ProBadge} />`}</div>
    </header>
    <main class="main" id="main" tabindex="-1">${children}</main>
    <nav class="tabbar" aria-label=${t('Main')}>
      ${NAV.map(([href, label, icon]) => html`<${Link} key=${href} href=${href} class="tab" aria-current=${isCurrent(href) ? 'page' : undefined}><${Icon} name=${icon} />${t(label)}</${Link}>`)}
    </nav>
  </div>`;
}

function PublicPage({ children }) {
  const { user } = useStore();
  return html`<div style=${{ minHeight: '100dvh' }}>
    <header class="topbar" style=${{ position: 'static' }}><${Link} href=${user ? '/' : '/login'} class="brand"><${Logo} size=${24} />ModaWard</${Link}><${Link} href=${user ? '/' : '/login'} class="btn btn-ghost btn-s">${user ? t('Open app') : t('Sign in')}</${Link}></header>
    <main class="main" id="main" tabindex="-1" style=${{ paddingBottom: '80px' }}>${children}</main>
  </div>`;
}

export function App() {
  // a screen that breaks shows a way out instead of a blank page, and is reported
  const [crash, clearCrash] = useErrorBoundary(reportError);
  const { ready, user, locale, bootError } = useStore();
  const path = usePath();

  useEffect(() => {
    boot();
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      set({ installPrompt: e });
    });
    addEventListener('appinstalled', () => set({ installPrompt: null }));
    addEventListener('offline', () => toast(t('You are offline. Some things may not load.'), { kind: 'err' }));
    // back online after a failed start: try again by itself
    addEventListener('online', () => state.bootError && boot());
  }, []);

  useEffect(() => {
    document.title = `${TITLES[path] ? t(TITLES[path]) : 'ModaWard'} · ModaWard`;
  }, [path, locale]);

  // a new screen starts at its top for keyboard and screen-reader users, as a page load would
  const firstPath = useRef(path);
  useEffect(() => {
    if (firstPath.current === path) return;
    firstPath.current = path;
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [path]);

  // route guards
  useEffect(() => {
    if (!ready) return;
    // read the live location: `path` can be stale if a view navigated while this effect was queued
    const here = location.pathname.replace(/\/+$/, '') || '/';
    if (!user && !PUBLIC.has(here)) navigate('/login', { replace: true });
    else if (user && ['/login', '/register', '/forgot'].includes(here)) navigate('/', { replace: true });
  }, [ready, user, path]);

  if (crash) return html`<main class="main" style=${{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}><div class="card card-pad stack center enter" role="alert" style=${{ maxWidth: '440px' }}><h1 class="display h-m">${t('Something went wrong. Please try again.')}</h1><div><button class="btn btn-primary" onClick=${() => { clearCrash(); navigate('/'); }}>${t('Try again')}</button></div></div></main>`;
  if (!ready) return html`<${Splash} />`;
  if (bootError && !user && !['/privacy', '/terms', '/unsubscribe'].includes(path)) {
    return html`<main class="main" style=${{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}><div class="card card-pad stack center enter" role="alert" style=${{ maxWidth: '440px' }}><h1 class="display h-m">${t('You appear to be offline. Check your connection and try again.')}</h1><div><button class="btn btn-primary" onClick=${() => { set({ ready: false }); boot(); }}>${t('Try again')}</button></div></div></main>`;
  }

  let page;
  if (path === '/login') page = html`<${AuthView} mode="login" />`;
  else if (path === '/register') page = html`<${AuthView} mode="register" />`;
  else if (path === '/forgot') page = html`<${AuthView} mode="forgot" />`;
  else if (path === '/reset') page = html`<${AuthView} mode="reset" />`;
  else if (path === '/privacy') page = html`<${PublicPage}><${PrivacyView} /></${PublicPage}>`;
  else if (path === '/terms') page = html`<${PublicPage}><${TermsView} /></${PublicPage}>`;
  else if (path === '/unsubscribe') page = html`<${PublicPage}><${UnsubscribeView} /></${PublicPage}>`;
  else if (!user) page = html`<${Splash} />`;
  else if (path === '/welcome') page = html`<${WelcomeView} />`;
  else if (path === '/trip') page = html`<${Shell} path=${path}><${TripView} /></${Shell}>`;
  else if (path === '/pro') page = html`<${Shell} path=${path}><${ProView} /></${Shell}>`;
  else if (path === '/admin' && user.isAdmin) page = html`<${Shell} path=${path}><${AdminView} /></${Shell}>`;
  else if (path === '/admin') page = html`<${Shell} path=${path}><div class="empty"><h1 class="display h-l">${t('Not an admin account')}</h1><p class="muted">${t('You are signed in as {email}. The admin tools open for the addresses listed in the server setting ADMIN_EMAILS. Add this address there, restart the app, then sign out and back in.', { email: user.email })}</p><${Link} href="/" class="btn btn-primary">${t('Back to today')}</${Link}></div></${Shell}>`;
  else {
    const view = { '/': TodayView, '/week': WeekView, '/closet': ClosetView, '/shop': ShopView, '/style': ProfileView }[path];
    page = view
      ? html`<${Shell} path=${path}><${view} /></${Shell}>`
      : html`<${Shell} path=${path}><div class="empty"><h1 class="display h-l">${t('Nothing here')}</h1><${Link} href="/" class="btn btn-primary">${t('Back to today')}</${Link}></div></${Shell}>`;
  }

  return html`<a class="sr-only skip-link" href="#main">${t('Skip to content')}</a>${page}<${UpgradeSheet} /><${Toasts} />`;
}
