# Architecture

## Shape

One Node.js process serves a JSON API and the static PWA. State lives in SQLite (plus a folder of photos). There is no build step: the browser loads ES modules directly, with Preact + htm bundled once into `public/vendor/ui.js`.

```
browser (PWA, Preact)  ──HTTPS──▶  Express 5 app  ──▶  services ──▶ repo (SQL) ──▶ SQLite
                                        │                  ├─▶ engine / shop (pure functions)
                                        │                  └─▶ weather · Stripe · Claude · remove.bg · SMTP
                                        └─ signed /go redirects, authenticated /uploads
```

`createApp(deps)` takes every dependency explicitly, so tests boot the real stack against an in-memory database with fake weather, billing and AI.

## The outfit engine (`src/engine`)

Pure functions; no I/O.

1. **Context** (`context.js`): reduces a forecast day to the hours that matter (waking hours, or the rest of today), classifies rain (none/light/heavy), snow, UV, wind and the temperature swing, and writes the heads-up tips.
2. **Thermal model** (`thermal.js`): each garment has an insulation value from its warmth rating; the sum is compared hour by hour with the insulation the feels-like temperature requires (knots calibrated to familiar outfits). Three things make it good rather than naive:
   - the outer layer is **removable**: each hour takes the better of "with" and "without", and warm dry hours never wear one, so "bring the jacket for the morning" falls out naturally;
   - body regions can't compensate for each other (a scarf does not warm bare legs), so shorts at −8 °C are penalised regardless of the top;
   - proportional under/over-insulation penalties keep ranking meaningful when the closet can't reach comfort.
3. **Scoring** (`scoring.js`): thermal comfort, rain/snow protection (waterproof outer, shoes that can take it), occasion and **formality coherence**, **colour harmony** (neutrals, one accent, analogous/complementary pairs, clashing darks, pattern clashes; `shared/color.js`), style affinity (quiz archetypes + liked/avoided colours + the **learned taste model**), and freshness (what was worn recently).
4. **Search** (`outfit.js`): two stages keep a request to a few thousand evaluations even for large closets. Rank "cores" (top+bottom, or dress) against the weather assuming the best outer layer; take the best cores and add every sensible shoe × outer combination; choose a **diverse** top-N; then add weather-driven accessories the person owns. Reasons and warnings are generated from the score components.
5. **Planner** (`planner.js`): plans the hardest days first so they get first pick, spreads pieces across the week with usage penalties.

Everything is deterministic given a seed (shuffle = new seed), which is what makes it testable.

## Taste model (`src/ai/taste.js`)

Online logistic regression over readable features (type, colour, pattern, formality band, brand, style tag, garment pairings, colour pairings). Each love/like/wear/save/skip/dislike is one SGD step. Scoring is done in log-odds space with a frozen bias so one-sided feedback never saturates ranking. Weights (≤ 1,500) are stored as JSON per user. It feeds the engine's style component and powers "Style DNA".

## Shopping (`src/shop`)

- **Pool** (`pool.js`, `specs.js`): the candidate pieces: real catalogue products plus a library of style-aware "specs" (type × colour × descriptor, per archetype palette). Hard rules are applied here: department, "never" tags, avoided colours/patterns, weather and occasion formality.
- **Looks** (`looks.js`): runs the *same engine* over the pool for a representative day of the coming week. Two kinds: all-new looks, and looks built around owned pieces (1–2 new). Results are diversified (no near-duplicates, hero-piece limits), interleaved across occasions and kinds, then given retailers.
- **Retailer assignment** (`assign.js`): scores retailers per piece on style fit, budget tier, category specialism, chosen stores and loved brands; honours avoided brands. Mix mode picks the best **pair** of stores per look (at most two parcels); single mode picks one store that carries everything; chosen stores are strict except for pieces none of them carries.
- **Gaps** (`gaps.js`): rule-based, explainable closet review against the forecast and occasions, with concrete colour-harmonised suggestions and "pairs with N of your pieces".
- **Links** (`links.js`): `/go` redirects are HMAC-signed so they can't be abused as an open redirect; the affiliate template is applied at redirect time; clicks are logged.
- **Feeds** (`feed.js`, `catalog.js`): CSV/JSON → catalogue rows with type/colour/gender inference that rejects what it can't place.

## AI (`src/ai`)

Claude is an *editor* on top of the deterministic engine, never the source of truth:

- **Curation** reorders and annotates candidates the engine already approved. Output is schema-constrained (`output_config.format`), then validated: unknown ids are dropped, nothing is added, a pick more than 12 points below the engine's best is demoted, text is stripped of markup and URLs. Free-text from users travels inside JSON data with a system rule to treat it as data (prompt-injection containment).
- **Vision** proposes type/colour/pattern/warmth/formality for a photo; values are clamped and re-validated.
- Calls are cached, budgeted per user and globally (`ai_usage`), request `fallbacks: "default"` for refusals, and **any** failure means the engine's own result is used. The app is complete without a key.

## Background removal (`src/shared/cutout.js`)

Classical, in-browser, private: model the backdrop from the photo's border in CIE Lab (k-means, ≤ 3 clusters), score each pixel against it with shadow discounting, Otsu-threshold, flood-fill from the border so interior details survive, drop specks, fill pin-holes, feather the edge. A self-check *declines* rather than ships a bad cut-out (low contrast, no clear backdrop, cluttered). Runs in a Web Worker. The same pure code is unit-tested in Node on synthetic photos with ground truth. An optional server-side remove.bg path covers hard photos for Pro.

## Static files and caching (`src/http/assets.js`)

Scripts, styles and the UI bundle are served under `/v/<build>/…` and the absolute imports inside them are rewritten to the same prefix, so every release has brand-new addresses and no browser, service worker or host cache can show an old screen. Versioned files are `immutable` for a year (development builds are `no-cache`). The plain `/js/…` and `/shared/…` addresses still work and serve the current code, so a stale page repairs itself. `index.html` and `/sw.js` are generated per build and are never cached.

## Quality checks

`npm run check` and the test suite gate every release. Beyond them, the release audit ran: axe-core accessibility checks over every screen in light and dark at phone and desktop sizes; a tap-target and overflow scan in all languages; failure simulation (500s, no connection, weather down) on every screen; a throttled-network load test; a concurrency test; a backup restore; and an independent read-only security review. The app reports its own errors to `client_errors`, shown in Business → System.

## Insights, events and trips

`src/shared/wardrobe-stats.js` is a pure function from the closet and the wear log to the numbers on *Closet → Insights* (it is unit-tested without a server). Planned days live in `day_plans` (`repos.plans`): `forDay` and `week` read them, so a planned occasion decides the outfits unless the person picks one explicitly, and the morning reminder reads the same row. `src/engine/trip.js` packs a trip: for each day and occasion it asks the normal engine for six candidates, then chooses greedily, hardest weather first, preferring outfits that reuse what is already in the bag and capping shoes and outer layers at two each. Free plans may pack up to the same number of days they may plan (3); Pro gets the whole forecast window.

## Reminders and push (`src/services/reminders.js`, `push.js`)

A timer in the server process wakes every five minutes. For each person with a reminder on, it works out their local date, hour and weekday from the time zone saved with their preferences, and a reminder is *due* once their local clock reaches its time (and no more than three hours later, so a restart never sends a morning outfit at night). A row in `reminder_log` is claimed **before** anything is built, which makes each reminder go out at most once per local day even if two processes run. Turning a reminder on after its time has passed waits for the next occurrence.

The message is built by the same service that powers the Today screen (outfit, weather tip), in the person's language, then sent through every channel they enabled: web push (`web-push`, VAPID keys auto-generated into `DATA_DIR/secrets/vapid.json`) and/or email (SMTP, opt-in, with a signed unsubscribe link and `List-Unsubscribe` header). Push endpoints are only accepted from the browser vendors' push services (`isPushEndpoint`), and subscriptions that return 404/410 are removed. Like the rate limiter, the timer assumes **one process**; the claim row keeps a second process from double-sending, not from doing the work.

## Languages

English text is the translation key: `t('Take the style quiz')`, with `{placeholders}` for values and `tn(n, '{n} piece', '{n} pieces')` for plurals (`Intl.PluralRules` picks the form). A missing translation falls back to the English text, so a gap never breaks a screen.

- **One mechanism for browser and server.** `src/shared/i18n.js` is the core. The browser loads `/shared/locales/<code>.js` on demand (`public/js/i18n.js`); the server loads the same files at start (`src/i18n/index.js`).
- **Which language.** The browser sends `X-Locale` with every API call (what the person chose, saved on their account as `profile.locale`); without it the server uses `Accept-Language`, then English. The request language drives outfit reasons, weather tips, shop look titles and reasons, closet-gap advice, error and validation messages, the password-reset email, starter-wardrobe names, and the language the AI stylist writes its notes in.
- **Labels defined at module level** (garment types, colour names, occasions…) are wrapped in `L('…')`, an identity marker the extractor can see; the screen calls `t(label)` when it renders. Colour names and other ids stay English in the database and API.
- **Not translated on purpose:** the Business (admin) screens, the legal pages (a mistranslated legal text is worse than an English one), garment names the person typed, and retailer product titles.
- **Dates, numbers, currency** use `Intl` in the active language; 24-hour clocks outside English.

**Add a language**
1. Add its code and native name to `LOCALES` in `src/shared/i18n.js`.
2. `node scripts/i18n.mjs scaffold <code>` writes `src/shared/locales/<code>.js` with every string and an empty value; fill it in.
3. `node scripts/i18n.mjs check` must pass (every string present, placeholders identical), then add the code to `ENABLED_LOCALES`.
4. Add the language name to `LANGUAGE_NAME` in `src/ai/stylist.js` so the AI notes follow.

**When code adds or changes text:** wrap it in `t()`/`tn()`/`L()`, run `node scripts/i18n.mjs check`, and add the new strings to each locale file. `npm run check` fails until every enabled language is complete. Right-to-left languages (Arabic, Hebrew) need a layout pass and are not enabled.

## Data

SQLite (WAL) via `node:sqlite`, or `better-sqlite3` on older Node, behind one adapter (`src/db/index.js`). Migrations are numbered `.sql` files applied at startup. All SQL is in `src/repo`, parameterised and scoped by user id. Deleting a user cascades everywhere. Photos are files named with 128 random bits and are served only to their owner.

## Security model

| Concern | Control |
|---|---|
| XSS | Strict CSP (`script-src 'self'`, `style-src 'self'`, no inline anything: checked in CI), output via Preact (escaped), AI/user text sanitised |
| CSRF | Required `X-Requested-With` header + Origin check + `SameSite=Lax` cookies |
| Sessions | 256-bit random token, only its SHA-256 stored, HttpOnly, Secure behind HTTPS, revoked on password change/reset |
| Passwords | scrypt (N=2¹⁵), parameters stored per hash, constant-time verify, dummy hash for unknown emails, concurrency-limited |
| Abuse | Per-IP and per-account rate limits, per-user caps on paid features, request size limits |
| Authorisation | Every query scoped by user id; tests assert cross-account access is impossible |
| Uploads | Magic-number + dimension validation, random names, never executable, `sandbox` CSP on delivery |
| Redirects | HMAC-signed `/go` links; https only |
| Payments | Webhook signature + timestamp tolerance, idempotency table, out-of-order protection; plan changes only ever come from webhooks |
| Secrets | Env or generated into `DATA_DIR/secrets` (0600); never logged; reset links built from `APP_URL`, not Host |
| Privacy | One-click export and delete (including photos and Stripe cancellation) |

## Testing

`npm test` runs ~200 unit/integration tests over real HTTP (engine scenarios with stylist-style assertions, taste learning, weather normalisation, image validation, auth/CSRF/isolation, plans, shop, feeds, billing signatures and lifecycles, AI with a fake SDK, background removal on synthetic photos). `npm run test:e2e` drives the real UI in Chromium on phone and desktop. `npm run check` is the static gate.

## Scaling notes

A single Node process comfortably serves thousands of users: engine requests take tens of milliseconds, weather is cached per ~1 km cell. SQLite, the reminder timer and the in-memory rate limiter assume **one process**. When you outgrow that: move to Postgres (all SQL is in `src/repo` and `src/db`), put the rate limiter and weather cache in Redis, and move photos to object storage.
