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
   **Stylist rules** (`stylist.js`) sit on top of those scores: a penalty for combinations that look wrong whatever the weather says (sportswear with tailoring, shorts in the cold or at work, sundresses and open shoes on cool days, rain boots in the dry, mismatched belts, black with brown), the person's **dress code** shifting what each occasion means for them, and their **never-suggest list** and avoided patterns applied to the pieces they own. An outfit has one top, or on a cool day a base with the layer that belongs over it (a curated list of pairs, drawn as a layered look). **Trends** (`shared/trends.js`, see `docs/TRENDS.md`) add a small bonus that is scaled by the person's own taste and can be switched off; the person's colour and "never" choices act as near-vetoes, and a piece they mark "never suggest" stays in the closet but never reaches the engine.
4. **Search** (`outfit.js`): two stages keep a request to a few thousand evaluations even for large closets. Rank "cores" (top+bottom, or dress) against the weather assuming the best outer layer; take the best cores and add every sensible shoe × outer combination; choose a **diverse** top-N; then add weather-driven accessories the person owns. Reasons and warnings are generated from the score components.
5. **Planner** (`planner.js`): plans the hardest days first so they get first pick, spreads pieces across the week with usage penalties.

Everything is deterministic given a seed (shuffle = new seed), which is what makes it testable.

## Taste model (`src/ai/taste.js`)

Online logistic regression over readable features (type, colour, pattern, formality band, brand, style tag, garment pairings, colour pairings). Each love/like/wear/save/skip/dislike is one SGD step. Scoring is done in log-odds space with a frozen bias so one-sided feedback never saturates ranking. Weights (≤ 1,500) are stored as JSON per user. It feeds the engine's style component and powers "Style DNA".

## Shopping (`src/shop`)

- **Pool** (`pool.js`, `specs.js`): the candidate pieces: real catalogue products plus a library of style-aware "specs" (type × colour × descriptor, per archetype palette). Hard rules are applied here: department, "never" tags, avoided colours/patterns, weather and occasion formality.
- **Looks** (`looks.js`): runs the *same engine* over the pool for a representative day of the coming week. Two kinds: all-new looks, and looks built around owned pieces (1–2 new). Results are diversified (no near-duplicates, hero-piece limits), interleaved across occasions and kinds, then given retailers.
- **Studio finish** (`src/shared/polish.js`): after the cut-out, a pure-JS pass in the same worker. It finds the turn (up to 14°) that makes an upright garment most mirror-symmetric and rotates by it (shoes and anything lying sideways are skipped); then, in brightness only (Lab L), it softens wrinkle-sized shading where the contrast is gentle (stripes, prints and deep folds pass through) and removes most of a one-sided lighting slope. Hue and colourfulness are untouched. Both the plain and the finished cut-out are kept so the person can switch it off. It is not generative: it cannot re-drape fabric or show a piece on a person (that needs an image-generation model; see docs/BUSINESS.md).
- **Store database** (`retailers.js`, `store-data.js`, `regions.js`): about 530 stores across 13 regions (United States, Canada, United Kingdom, Australia, Germany/Austria/Switzerland, France, Spain, Italy, Portugal, Netherlands, Türkiye, Brazil, Mexico) plus global brands. The original fourteen US stores are tuned by hand; every other store is one line of data (tier, department, style character, what it sells, where it ships, where it is a starter store, optional native search URL). A store's search link is its own page where we are certain of it and a Google `site:` search of its website otherwise, so every link is valid. `npm run stores:check` visits each website and lists any that no longer answer. A person's region (their choice, else guessed from currency and language) decides the starter set used when they have picked no stores; for the United States that set is exactly the original fourteen.
- **Stores people add** (`custom-stores.js`, table `custom_stores`): a name, a website and an optional search link with `{q}`. The address is checked hard (public https site only: no IP addresses, no localhost or internal names, no ports, no passwords) because it becomes the target of signed links; the server never fetches it. A person's stores are private to them, are chosen when added, join the engine as mid-priced stores that carry everything, and their links go through the same signed `/go` redirect (a link to a removed store stops working).
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

## Track Weight (`/trackweight`)

A calorie, macro, exercise and weight tracker that is its own page of the site, not a screen of the app. `GET /trackweight` serves `public/trackweight.html` (its own title, manifest and install scope) through `assets.page()`, so its scripts and styles get the same `/v/<build>/…` addresses, import rewriting and start-up preloading as the app, and it is registered before the single-page fallback so the app never swallows it. It uses the site's design system (`css/app.css`) plus a small `css/trackweight.css`.

- **Members only by default.** `src/services/trackweight-access.js` decides who may use it: admins, and accounts listed in `trackweight_members` (migration 016, keyed by account id with `ON DELETE CASCADE`, so deleting an account ends the membership). It is keyed by account and not by email because ModaWard does not verify email addresses: an address on a list could be claimed by whoever registers with it first, so only existing accounts can be added (*Business → Track Weight*, `/api/admin/trackweight/members`). `GET /trackweight` answers a visitor 401 and an unapproved account 403 with a small "members only" page (`public/trackweight-locked.html`, filled in and HTML-escaped on the server, never cached), and every `/api/trackweight` route answers 401/403 the same way, so no food database or model call is made for a non-member. `TRACKWEIGHT_ACCESS=open` lifts the rule. The page's scripts and styles are ordinary static files and stay reachable; what is protected is the feature, its API and the AI spend, and the diary itself never leaves the device. The service worker keeps a copy of the real page for offline use and deletes it when the server answers 401/403.
- **The diary lives on the person's device.** `public/js/trackweight/db.js` is a small IndexedDB layer (entries, workouts, weigh-ins, saved foods, settings) with a change feed and a `useQuery` hook; backup and restore are JSON files. There is no account, no table and nothing to delete on the server, so it does not touch the export/delete flows. `src/shared/nutrition.js` (BMR, maintenance, targets with a 1,200/1,500 kcal floor, MET exercise calories) and the built-in library (`foods-seed.js`: about 150 basics per 100 g; `foods-dishes.js`: about 500 typical dishes from many cuisines, written per serving and marked `approx`; `activities.js`; `food-search.js`: a forgiving search that ignores case, accents and plurals, understands UK/US words such as crisps or aubergine, and tolerates a typo or two) are pure shared modules, unit-tested in Node.
- **What the library is, and is not.** The dishes are typical values for a kind of dish (USDA survey data and common restaurant and recipe portions, rounded), shown with a note on the portion screen. They are not any restaurant's or meal-kit service's own data: those publish nutrition only on their own pages, with no public feed, so exact numbers go in through the Manual tab. A test checks that every food's calories agree with its macros (alcohol excepted) and that ids, categories and serving sizes are sane. With a USDA key the online search also covers the USDA survey of mixed dishes.
- **Server pieces** (`src/http/routes/trackweight.js`): `GET /api/trackweight/status`, `…/foods/search?q=`, `…/foods/barcode/:code` (open to everyone, rate-limited, and answered from a ten-minute in-memory cache) and `POST …/analyze-meal`. Food search goes through `src/services/foods.js`: Open Food Facts always, USDA FoodData Central when `USDA_API_KEY` is set, normalised to values per 100 g. If every database is down the endpoint answers 503, never an empty list.
- **Meal photos** (`src/ai/meals.js`) go through the shared AI client, so they use the site's `ANTHROPIC_API_KEY`, are metered per person and per day in `ai_usage` (kind `meal_photo`) and fall back to "try again" on any failure. They need a signed-in person and follow the same switch as photo auto-tagging (`entitlements().photoTagging`: `FREE_AI` on a free site, Pro on a paid one). The model is `AI_MEAL_MODEL` (default `claude-sonnet-5-5`; the stylist keeps `AI_MODEL`). The browser shrinks the photo to 1280 px first. Nothing is stored: the photo is sent for that request only. Claude returns schema-constrained JSON (items with grams, calories, macros and a confidence); `normaliseMeal` clamps every number and strips markup, and the person's hint travels as quoted data with a system rule to treat it as such. The page shows every item for correction (editing grams rescales the estimate) before anything is saved.
- **Offline.** The service worker precaches the page and its entry modules, and falls back to the cached `/trackweight` for navigations, so the page and the diary open without a connection once it has been visited twice (the first visit installs the worker; the second caches the modules). Online search, barcodes and photos need a connection and say so.
- **Colour.** The page sits on the site's design system but gives each tab its own hue (`body[data-tab]` sets `--tw-a`/`--tw-a2` in `css/trackweight.css`): gradient hero cards, a colour for each meal and macro, gradient buttons and a tab bar that lights up per tab. Inks are darker on light pages and lighter in dark mode so text stays readable.
- **Not yet translated.** The page is English only; the server's error messages for it are translated like all others. Wrapping its text in `t()` and adding the strings to the locale files is the way to add the other languages.

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
