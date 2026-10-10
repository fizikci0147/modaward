# Changelog

Versions follow [semver](https://semver.org): **major** = a change that needs action from the owner, **minor** = new features, **patch** = fixes. Every zip is named `modaward-<version>-<commit>.zip`, `/health` reports the same `version` and `build`, and the app shows them under *You → Account*.

> Releases up to 5.2.0 were all uploaded as `modaward-5.0.0.zip`. They are numbered below after the fact so the history is readable; from 5.3.0 on, each zip carries its real version.

## [5.6.0] · 2026-10-11

A quality and security pass: automated accessibility checks on every screen, an independent security review, failure testing and a load test.

### Fixed: security
- **A closet limit loophole.** Archiving pieces let a free account keep adding more. Every piece now counts toward a hard storage cap (100 free, 2,000 Pro).
- **Reset emails could carry someone else's HTML** through a person's name. Names are now escaped.
- **Reset emails** are capped to 3 an hour per address, whoever asks; "send me a test" to 5 an hour; sending a reset no longer reveals through timing whether an address has an account.
- **Sign-in, sign-up, forgot and reset each have their own attempt limit**, so people behind one network address cannot lock each other out.
- **Reset links are no longer written to the server log in production** (set `LOG_MAIL_BODIES=1` to bring that back if you have no email set up).
- **Deleting an account now stops if the subscription cannot be cancelled**, instead of deleting the account and leaving the person being charged.
- Session cookies are always `Secure` in production; a malformed cookie or file path no longer causes a server error; anonymous visitors can no longer make the server read multi-megabyte bodies; push notifications only go to Google's FCM service (not any Google host) and a person is limited to 10 devices; `/go` and city search are rate limited; old click records are purged.
- The server warns at startup if an `ADMIN_EMAILS` address has no account yet.

### Fixed: accessibility and polish
- Small grey text now meets WCAG AA contrast in light and dark mode (previously about 3.6:1).
- Skip-to-content links work on every page; heading levels no longer skip; faded temperatures on the Week days are readable.
- Small buttons (swap, favourite, remove, chips) have bigger tap areas on touch screens.
- The Welcome screens no longer sit 12px off-centre on phones; the Week row respects its padding.
- Admin sections and Reminders show an error and a retry button, instead of a loading placeholder forever, when the server cannot be reached.

### Added
- **Problems in people's browsers** (Business → System): errors in the app's own code are reported and grouped, so bugs are found before anyone writes in. A broken screen shows "Something went wrong" with a way out instead of a blank page.
- Business → System shows the visitor address as the app sees it, so you can check the proxy setting.
- Start-up files are preloaded together, and colour maths is cached.
- Data export includes planned days and reminder settings.

## [5.5.1] · 2026-10-11

### Fixed
- **A new release could look like it had not changed anything.** If a browser, the service worker or the hosting provider's cache kept old copies of the app's script files, people kept seeing the old screens even though the server was updated. Each build now serves its scripts and styles under its own address (`/v/<build>/…`), so no cache can show an old release. Because those addresses never change, they are also cached for a year, which makes repeat visits faster. The old addresses still work and now serve the current code.

## [5.5.0] · 2026-10-11

### Added
- **Closet → Insights.** How much of the closet gets worn (last 30 and 90 days), what has never been worn, the closet's value, **cost per wear** (best value, and which pieces are worth wearing more), most worn pieces, what the closet is made of, forgotten pieces with a one-tap *Style it*, and a short "What's missing" list that links to the Shop's gap finder.
- **What you paid** on every piece (optional), and a **Currency** setting in *You → About you*.
- **What's on this day?** On the Week screen, tell the app a day is for a wedding, a dinner, the office. The outfits follow, Today opens on that occasion with your note, and the morning reminder uses it too.
- **Pack for a trip** (`/trip`, linked from Week and Insights): choose a destination, start day, length and occasions. It picks the fewest pieces from your closet that suit every day's forecast at the destination (shoes and outer layers capped at two each), with a tick-off checklist, an outfit for each day, and a copy/share button. Free: up to 3 days. Pro: the whole 8-day forecast.

### Changed
- The Week header no longer runs two sentences together.
- Data export now includes planned days and reminder settings.

## [5.4.0] · 2026-10-10

### Added
- **Not worn in a while.** Every piece shows when it was last worn ("Last worn 3 weeks ago", "Not worn yet · added 2 months ago"). Pieces idle for 60+ days (or never worn 3 weeks after being added) get an *Idle* tag, a **Not worn lately** filter, a **Sort by longest unworn** option, and a "Not worn in a while" card at the top of the closet with one-tap **Style it** and **Wore it today**. A piece's own screen has a wear history with *I wore it today* and back-dating. The outfit engine now gently brings forgotten pieces back and says so ("Brings back the navy polo, which you last wore 4 months ago").
- **Style it**: outfits built around one chosen piece (from the closet).
- **Add several pieces at once**: pick up to 40 photos; backgrounds are removed in the browser, and with the AI stylist on, Claude recognises the pieces (six photos per call, so a 36-photo closet is six calls). Everything lands on one review screen where you fix types or colours and add them all together. Without AI you choose the type for each piece and still add them in one go.
- **Reminders**: a morning outfit at a time you choose, a Sunday-evening look at the week ahead, and a Saturday nudge about forgotten pieces. Delivered as **push notifications** (Android, desktop, and iPhone once added to the Home Screen) and/or **email** (off until the person turns it on; every email has an unsubscribe link). Follows each person's language and time zone. *You → Reminders* has a "Send me a test" button.
- **Share an outfit as a picture** (1080×1350) from the Today screen, through the phone's share sheet or as a download.
- **Business → Products**: add a hand-picked product (store, link, photo address, price, type, colour) or **upload an affiliate feed** (CSV, TSV or JSON) in the browser, preview what will be imported, then import. Browse, mark out of stock, or delete products.

### Changed
- Web push uses VAPID keys that are generated once and kept in the data folder, so it needs no setup. The optional `PUSH_ENABLED`, `VAPID_*` and `REMINDERS_*` settings are in `.env.example`.

### Security
- Push subscriptions are only accepted from the browser vendors' real push services, so the server can never be pointed at an arbitrary address.

## [5.3.0] · 2026-10-08

### Added
- **Seven languages**: English, Spanish, French, German, Portuguese, Italian and Turkish. Screens, outfit explanations, weather tips, shop looks, closet-gap advice, error messages, the password-reset email and the AI stylist's notes all follow the language people pick (saved on their account). City search results come back in that language too.
- `node scripts/i18n.mjs check` (part of `npm run check`) fails when any language is missing a string or a placeholder differs.
- Business → Overview shows which languages people choose.
- Version and build shown in *You → Account* and Business → System.

### Changed
- Zips are named `modaward-<version>-<commit>.zip`, and packaging refuses a tree with uncommitted changes, so a zip always matches a commit. A release needs a matching `CHANGELOG.md` entry.
- The service worker cache is versioned per build automatically.

### Fixed
- Phone layouts (360px) no longer overflow sideways, including a small existing overflow on *Sizes & fit*.

## [5.2.0] · 2026-10-08

### Added
- **Dislike** is a labelled thumbs-down on outfits and shop looks; any single piece of today's outfit can be swapped out ("Not using today"); closet tiles have a quick remove.
- Business → **Overview** grows: signup funnel, audience (styles, cities, departments, ages), retention, paying vs comped Pro, closet and shopping activity, and **when people use the app** (weekday × hour heatmap, daily users, stickiness).
- Business → **Users**: searchable, filterable list with plan, last seen, closet size and activity.
- Business → **System**: one-click check of the weather service and your settings, with the exact failure reason.
- `/health` reports a build id.
- Impact affiliate site-verification tag.

### Fixed
- "Last seen" now updates while people use the app (it was only set at sign-in).
- Weather failures are logged with their real cause instead of a generic message.

## [5.1.0] · 2026-10-06

### Added
- **Pro codes** (redeemable on the Pro page) and **give Pro by email**, both time-limited and managed in Business → Pro access. Comped time ends by itself; a paying Stripe subscriber is never overridden.

## [5.0.2] · 2026-10-06

### Security
- Upgraded `nodemailer` to 10.0.15, clearing 13 published advisories.
- API responses are marked private and uncacheable so a proxy or CDN can never serve one person's data to another.

## [5.0.1] · 2026-10-06

### Fixed
- Hostinger **503s**: a failed start now serves a readable page and writes `startup-error.log` (`SHOW_STARTUP_ERRORS=1` shows the reason); `app.js` and `index.js` entry points for hosts with a different default; SQLite falls back from WAL where the filesystem can't do it; `npm run doctor`.
- A database left by an older app in the data folder is set aside instead of crashing the migration.

## [5.0.0] · 2026-10-06

First complete release: weather-aware outfit engine, closet with automatic background removal, Stitch Fix-style shop with mixed-store looks and closet-gap advice, full style profile, learning taste model, optional Claude stylist, Pro subscriptions with Stripe, affiliate tracking and feed importer, PWA, security hardening, tests and docs.
