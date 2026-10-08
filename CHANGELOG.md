# Changelog

Versions follow [semver](https://semver.org): **major** = a change that needs action from the owner, **minor** = new features, **patch** = fixes. Every zip is named `modaward-<version>-<commit>.zip`, `/health` reports the same `version` and `build`, and the app shows them under *You → Account*.

> Releases up to 5.2.0 were all uploaded as `modaward-5.0.0.zip`. They are numbered below after the fact so the history is readable; from 5.3.0 on, each zip carries its real version.

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
