# ModaWard for iOS and Android

The iOS and Android apps live in `mobile/`. They are native shells (built with [Capacitor](https://capacitorjs.com)) around **the same web app that runs on modaward.com**: each app opens `https://modaward.com` inside a full-screen native web view, with its own icon, launch screen, permissions, an offline screen and the native back button.

## The one rule: one codebase

> **Change the website and you have changed both apps.**

Because the apps load the live site, every change under `public/` and `src/` (screens, styling, the outfit and shop engines, translations, the server) reaches the website, the iPhone app and the Android app **at the same time, with nothing to rebuild or resubmit** to the stores. Only changes inside `mobile/` (icon, splash screen, permissions, native plugins, the app version) need a new app build.

The few places where the apps differ are all in one file, `public/js/native.js` (`isNativeApp`, `canBuyProHere`). The apps add `ModaWardApp` to the browser's user-agent, which is how the web app knows where it is. A browser test (`runNative` in `test/e2e/run.mjs`) runs the site as the apps will, so a change that breaks the apps fails the build.

## What works today, and what is still to do

Built, and checked here by browser tests and by reading the generated projects:

- iOS project (`mobile/ios`, Swift Package Manager, iOS 15+, iPhone and iPad) and Android project (`mobile/android`, Android 7+, target SDK 36), both pointing at the live site.
- App icons and launch screens in every size, light and dark (`mobile/assets`, regenerated with `npm run assets`).
- Permissions with the explanations the stores require: camera and photos (adding a piece to the closet), location while in use (weather).
- A branded offline screen (in the phone's language) with a *Try again* button.
- The same version number as the website, set automatically (`npm run sync`).
- Nothing in the apps offers or links to buying Pro (see *Payments* below).

**Not tested on a real phone yet. That is what you do next, on your Mac and your phone.** I could not run Xcode or the Android tooling where this was written, so the first build may need a small fix. Send me whatever Xcode or Android Studio reports and I will fix it.

Still to do before a public store release:

1. **In-app purchase for Pro** (required by Apple and Google, see *Payments*).
2. **Native push notifications** (the website's web push does not work inside an app web view; email reminders work now). See *Notifications*.
3. Store listings: screenshots, description, age rating, privacy answers (checklist below).

## What you need

| | |
|---|---|
| **A Mac** | macOS with the latest **Xcode** (App Store requirement: apps are built with the current Xcode). Install the command-line tools once: `xcode-select --install`. |
| **Node.js 22 or newer** | `node -v` |
| **Android Studio** | latest, with its bundled JDK, plus an emulator or a phone with USB debugging on. |
| **Apple Developer Program** | US$99 a year, needed to put the app on your own iPhone for more than a week, TestFlight and the App Store. https://developer.apple.com/programs/ |
| **Google Play Console** | one-time US$25. https://play.google.com/console |

The app id is `com.modaward.app` on both stores. Change it **before the first upload** if you want a different one (in `mobile/capacitor.config.js`; then delete `mobile/ios` and `mobile/android` and run `npx cap add ios`, `npx cap add android` again, because stores never let you change it later).

## First run on your Mac

```bash
cd mobile
npm install
```

### Against the live site (modaward.com)

```bash
npm run ios        # prepares the app, then opens Xcode
npm run android    # prepares the app, then opens Android Studio
```

- **Xcode:** pick your *Team* under *App → Signing & Capabilities* (your Apple ID is enough for testing), choose an iPhone simulator or your plugged-in iPhone at the top, press ▶ Run. On the phone you may need to trust the developer once: *Settings → General → VPN & Device Management*.
- **Android Studio:** let Gradle finish syncing, choose an emulator or your phone (USB debugging on), press ▶ Run.

### Against a test server on your own computer (to try a change before publishing)

1. Start the website on your Mac, reachable from your network. Leave `NODE_ENV` unset (so cookies work over plain http):
   ```bash
   # in the main project folder
   HOST=0.0.0.0 npm start
   ```
2. Find your Mac's address (*System Settings → Wi-Fi → Details*, for example `192.168.1.20`). Open `http://192.168.1.20:8080` in your phone's browser first, to check it loads.
3. Build the apps for that server:
   ```bash
   cd mobile
   MODAWARD_URL=http://192.168.1.20:8080 npm run ios      # or: npm run android
   ```
   The Android emulator reaches your Mac at `http://10.0.2.2:8080`. Phone and Mac must be on the same Wi-Fi. Plain http is only allowed for addresses on your own network.
4. **Switch back before a release:** run `npm run sync` with no `MODAWARD_URL`, so the app points at `https://modaward.com` again.

## Test checklist (do this on both an iPhone and an Android phone)

- Opens to the front page with no flash of white; launch screen shows the hanger on the cream (or dark) background.
- Sign up (the agreement box, show/hide password), take the style quiz, reach Today.
- An outfit appears with the right weather; swap a piece; *I'm wearing this*.
- **Closet → Add a piece → take a photo**: the camera permission prompt appears with the text above, the photo is cut out and added.
- **Use my location** asks once and sets the city.
- Week, trip packing list, the Shop: tapping a product opens the shop in the phone's **browser**, and coming back lands in the app.
- Switch language (*You → About you*); turn the phone to dark mode (the app follows).
- Airplane mode, then open the app: the offline screen shows, and *Try again* works after you turn the signal back on.
- Android: the back button goes back inside the app and closes it only from the first screen.
- Nothing anywhere says *Go Pro*, *Upgrade* or offers a price. (A new account does show *3 months of Pro, free for new members*, and its Pro features work.)
- Sign out and back in; close the app fully and reopen (you should still be signed in).

## Releasing

1. Make the change in the main project (website and apps share it). Bump the version in the main `package.json` as usual and deploy the website. **Apps that are already installed pick the change up the next time they open.**
2. Only if something under `mobile/` changed (or the store needs a new build): `cd mobile && npm run sync` (it also sets the apps to the website's version number; the build number always goes up).
3. **iOS:** `npm run ios` → in Xcode choose *Any iOS Device* → *Product → Archive* → *Distribute App → App Store Connect*. Test it first in **TestFlight** (App Store Connect → TestFlight), then submit for review.
4. **Android:** `npm run android` → *Build → Generate Signed App Bundle (AAB)*. Let Google **Play App Signing** hold the release key, and keep your upload keystore and its password somewhere safe (a password manager and a backup): losing it makes updates painful. Upload to Play Console → *Testing → Internal testing* first, then production.

## Payments: why the apps do not sell Pro (yet)

Apple (App Store Review Guideline 3.1.1) and Google (Play payments policy) require that subscriptions for digital features bought *inside an app* use **their** in-app purchase (they keep a commission, usually 15% to 30%), and they do not allow the app to link or point to another way of paying. Stripe checkout inside the apps would get the apps rejected or removed. So today:

- The apps show no *Go Pro*, price, upgrade or billing button (`canBuyProHere` in `public/js/native.js`).
- Pro the person **already has** works in the apps: the 3-month welcome offer, a code, or a subscription bought on the website.
- A locked feature in the apps just says it is part of ModaWard Pro.

To sell Pro inside the apps the next step is **in-app purchase** with [RevenueCat](https://www.revenuecat.com) (it has a free tier) or StoreKit and Play Billing directly, plus a server endpoint that turns a verified purchase into Pro on the account (the same way a Stripe payment does today). Tell me when you want it.

## Notifications

Inside the apps, **email reminders work** (including "your free Pro is about to end"). The website's browser push does not run in an app's web view, so push notifications in the apps need **native push**: Firebase Cloud Messaging for Android and Apple's push service for iOS, a server table of device tokens and a sender. It needs a Firebase project and an Apple push key (both yours to create); I can build everything else.

## Store listing checklist

- **Privacy policy URL:** `https://modaward.com/privacy` (already covers the apps).
- **Account deletion** inside the app is required by both stores: *You → Account → Delete account* exists.
- **Sign in with Apple** is only required if you add sign-in with Google/Facebook; the app uses email and password, so it is not needed.
- **App Store privacy answers** (data linked to the person): contact info (email, name), user content (photos of clothes), location (approximate and precise, from "use my location", used for weather), identifiers and usage data (sign-in session, error reports). No tracking, no ads. Play Console "Data safety" asks the same.
- **Age rating:** the sign-up requires age 16+; answer the questionnaires accordingly (no mature content).
- **Review demo account:** create one with the 3 months of Pro active, and put its email and password in *App Review Information* and *App access*.
- **Affiliate links:** the Shop opens retailers outside the app and says so (see the Terms). Mention nothing about prices in the listing text that you cannot honour.
- **Screenshots:** iPhone 6.9" and 6.5", iPad 13" (the apps support iPad); Android phone (and tablet if offered). I can produce clean screenshots from the real app on request.
- **Export compliance:** already answered in the app (`ITSAppUsesNonExemptEncryption = false`: HTTPS only).

## Troubleshooting

- **A white screen on launch**: the app could not reach the site. Open the same address in the phone's browser. On a test server, check the phone is on the same Wi-Fi and the address in `MODAWARD_URL` is right.
- **Signed out every time on a test server**: leave `NODE_ENV=production` unset on the test server (production cookies need https).
- **`npm run android`: SDK not found**: open the project once in Android Studio so it creates `local.properties`, or install the SDK it asks for.
- **Xcode: "Signing requires a development team"**: choose your Team under *Signing & Capabilities*.
- **I changed the website and the app looks the same**: the app loads the live site; check the website itself first (`/health` shows the version), then force-quit and reopen the app.
- **The icon or launch screen looks wrong**: edit `mobile/tools/make-assets.mjs`, then in `mobile/` run `npm run assets && npm run sync` (it installs its own small toolset the first time; a normal `npm install` stays minimal).
- **`npm install` shows "deprecated" lines or "3 moderate vulnerabilities"**: normal. They come from Capacitor's own command-line tool, which only runs on your computer to build the app and is not part of the app you ship. There is no upstream fix yet; ignore them, and do not run `npm audit fix --force`.
