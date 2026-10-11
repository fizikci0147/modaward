/**
 * The same web app runs in the browser and inside the iOS and Android apps (see mobile/).
 * The apps announce themselves in the user agent ("ModaWardApp"), so this is how the one codebase
 * knows where it is. Keep the differences few and put them here.
 */
export const isNativeApp = typeof navigator !== 'undefined' && /ModaWardApp/.test(navigator.userAgent || '');

/**
 * Apple and Google require their own in-app purchase for subscriptions bought inside an app, so the
 * apps do not offer Stripe checkout or send people to it. Pro the person already has (a welcome offer,
 * a code, a subscription from the website) works everywhere. See docs/MOBILE.md.
 */
export const canBuyProHere = !isNativeApp;

/** Called once at start-up: native-only polish, and nothing at all in a browser. */
export function initNative() {
  if (!isNativeApp) return;
  const root = document.documentElement;
  root.dataset.app = 'native';
  try {
    // the launch screen stays until the first screen is drawn (the system bars follow the phone's light or dark mode by themselves)
    requestAnimationFrame(() => window.Capacitor?.Plugins?.SplashScreen?.hide?.()?.catch?.(() => {}));
  } catch {
    /* the app works without it */
  }
}
