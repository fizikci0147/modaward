/**
 * ModaWard for iOS and Android.
 *
 * The apps are native shells around the SAME web app that runs on the website: they load it from
 * MODAWARD_URL (https://modaward.com by default). So there is one codebase: a change to the website
 * is a change to both apps, with nothing to rebuild or resubmit. Only changes to this folder (the
 * native shell: icons, permissions, plugins) need a new app build.
 *
 * To test against a server on your own computer, run:  MODAWARD_URL=http://192.168.1.20:8080 npm run sync
 */
const url = (process.env.MODAWARD_URL || 'https://modaward.com').replace(/\/+$/, '');
const host = new URL(url).host;

module.exports = {
  appId: 'com.modaward.app',
  appName: 'ModaWard',
  webDir: 'www',
  // lets the web app know it is running inside the app (see public/js/native.js)
  appendUserAgent: 'ModaWardApp',
  server: {
    url,
    cleartext: url.startsWith('http://'), // only ever for testing against your own computer
    // shown when the server cannot be reached (airplane mode, no signal): a branded page with a Retry button
    errorPath: 'offline.html',
    // everything on the site stays inside the app; links to other sites (shops, Stripe, legal sources) open in the system browser
    allowNavigation: [host]
  },
  ios: {
    contentInset: 'never', // the web app handles safe areas itself (viewport-fit=cover and env(safe-area-inset-*))
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: '#f6f3ed',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false
    },
    Keyboard: {
      resize: 'native'
    }
  }
};
