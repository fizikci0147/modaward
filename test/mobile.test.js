import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const require = createRequire(import.meta.url);

/** The iOS and Android apps are shells around this same web app (docs/MOBILE.md). These keep them honest. */
describe('iOS and Android apps', () => {
  test('the config loads the live website, announces itself, and has an offline page', () => {
    const saved = process.env.MODAWARD_URL;
    delete process.env.MODAWARD_URL;
    delete require.cache[require.resolve('../mobile/capacitor.config.js')];
    const cfg = require('../mobile/capacitor.config.js');
    if (saved !== undefined) process.env.MODAWARD_URL = saved;
    assert.equal(cfg.appId, 'com.modaward.app');
    assert.equal(cfg.appendUserAgent, 'ModaWardApp'); // public/js/native.js looks for exactly this
    assert.equal(cfg.server.url, 'https://modaward.com');
    assert.equal(cfg.server.cleartext, false, 'plain http is for local testing only');
    assert.equal(cfg.server.errorPath, 'offline.html');
    assert.ok(cfg.server.allowNavigation.includes('modaward.com'));
    assert.match(read('public/js/native.js'), /ModaWardApp/);
  });

  test('the user agent the apps send is what the web app looks for', async () => {
    const setUA = (userAgent) => Object.defineProperty(globalThis, 'navigator', { value: { userAgent }, configurable: true, writable: true });
    setUA('Mozilla/5.0 (iPhone) Mobile/15E148 ModaWardApp');
    const app = await import(`../public/js/native.js?app`);
    assert.equal(app.isNativeApp, true);
    assert.equal(app.canBuyProHere, false);
    setUA('Mozilla/5.0 (Macintosh) Safari/605.1.15');
    const web = await import(`../public/js/native.js?web`);
    assert.equal(web.isNativeApp, false);
    assert.equal(web.canBuyProHere, true);
  });

  test('both projects use the same app id, and the same version as the website', () => {
    const gradle = read('mobile/android/app/build.gradle');
    const xcode = read('mobile/ios/App/App.xcodeproj/project.pbxproj');
    assert.match(gradle, /applicationId "com\.modaward\.app"/);
    assert.match(xcode, /PRODUCT_BUNDLE_IDENTIFIER = com\.modaward\.app;/);
    const [major, minor, patch] = pkg.version.split('.').map(Number);
    const code = major * 10000 + minor * 100 + patch;
    assert.match(gradle, new RegExp(`versionName "${pkg.version.replace(/\./g, '\\.')}"`), `run "npm run sync" in mobile/ so Android is at ${pkg.version}`);
    assert.match(gradle, new RegExp(`versionCode ${code}\\b`));
    assert.match(xcode, new RegExp(`MARKETING_VERSION = ${pkg.version.replace(/\./g, '\\.')};`), `run "npm run sync" in mobile/ so iOS is at ${pkg.version}`);
    assert.match(xcode, new RegExp(`CURRENT_PROJECT_VERSION = ${code};`));
  });

  test('the permissions the app needs are declared, with the explanations the stores require', () => {
    const plist = read('mobile/ios/App/App/Info.plist');
    for (const key of ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSLocationWhenInUseUsageDescription']) assert.match(plist, new RegExp(`<key>${key}</key>\\s*<string>[^<]{30,}</string>`), key);
    assert.match(plist, /ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
    const manifest = read('mobile/android/app/src/main/AndroidManifest.xml');
    for (const perm of ['INTERNET', 'CAMERA', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']) assert.ok(manifest.includes(`android.permission.${perm}`), perm);
    assert.match(manifest, /android:allowBackup="false"/);
  });

  test('icons and launch screens exist for both platforms', () => {
    for (const f of ['mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json', 'mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', 'mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'mobile/assets/icon-only.png', 'mobile/assets/splash.png']) {
      assert.ok(fs.existsSync(path.join(root, f)), f);
    }
    const icon = fs.readFileSync(path.join(root, 'mobile/assets/icon-only.png'));
    assert.equal(icon.readUInt32BE(16), 1024); // PNG width
    assert.equal(icon.readUInt32BE(20), 1024);
  });

  test('no stray image files sit in the iOS asset sets (Xcode warns about "unassigned children")', () => {
    const sets = path.join(root, 'mobile/ios/App/App/Assets.xcassets');
    for (const set of fs.readdirSync(sets).filter((d) => d.endsWith('.imageset') || d.endsWith('.appiconset'))) {
      const dir = path.join(sets, set);
      const used = new Set(JSON.parse(fs.readFileSync(path.join(dir, 'Contents.json'), 'utf8')).images.map((i) => i.filename).filter(Boolean));
      const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|pdf|svg)$/i.test(f));
      assert.deepEqual(files.filter((f) => !used.has(f)), [], `${set} has image files nothing refers to`);
      assert.deepEqual([...used].filter((f) => !files.includes(f)), [], `${set} refers to missing files`);
    }
  });

  test('the fallback pages point at the server and are filled in by the build script', () => {
    for (const t of ['mobile/templates/index.html', 'mobile/templates/offline.html']) assert.ok(read(t).includes('__SERVER_URL__'), t);
    assert.match(read('mobile/scripts/prepare-www.mjs'), /MODAWARD_URL/);
  });
});
