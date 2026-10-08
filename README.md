# ModaWard

**Dress for the day ahead.** ModaWard plans what to wear from the person's own closet and the hour-by-hour forecast, then suggests complete looks to buy from the stores they like, mixing brands (an H&M top with Banana Republic trousers) or staying in one store. It learns each person's taste from every outfit they love or skip.

It is an installable web app (PWA) with an Express server and a SQLite database. There is no build step, and it deploys as a normal Node.js app (Hostinger Node.js hosting included).

| | |
|---|---|
| **Closet** | Add pieces with or without a photo. Photos get an automatic **background removal** (in the browser, private, instant) and colour detection. |
| **Today / Week** | Weather-aware outfits per occasion, with the reasoning shown. A layering model knows what you can take off by the afternoon; rain, snow, heat and cold change what is chosen. |
| **Shop** | Stitch Fix-style looks: all-new outfits *and* looks built around what you already own, picked for your style quiz, colours, never-wear rules, budget, sizes and the week's weather. Closet-gap analysis explains what is missing. |
| **Profile** | A full styling profile: style quiz (visual), colours, patterns and "never suggest" rules, brands and stores, sizes, fit by body area, occasions, dress code, per-category budget, a note for the stylist. |
| **Learns** | An on-device-style taste model (online logistic regression) trains on love / skip / wear / save signals. "Style DNA" shows what it learned. |
| **AI stylist (optional)** | Claude orders the engine's candidates and writes a stylist's note; it can read a garment photo and pre-fill the form. It can only choose among weather-safe candidates and its output is validated. |
| **Pro subscriptions** | Stripe Checkout + billing portal + signed webhooks. Free vs Pro limits are enforced on the server. |
| **Languages** | English, Spanish, French, German, Portuguese, Italian and Turkish: the screens, outfit explanations, weather tips, error messages, emails and the AI stylist's notes. Picked automatically from the browser, changeable any time, and saved on the account. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#languages). |
| **Revenue** | Affiliate redirects with click tracking, retailer product-feed importer (real product photos and prices), admin metrics. |

## Quick start

```bash
npm install
cp .env.example .env          # optional: the app runs with no configuration
WEATHER_PROVIDER=mock npm start   # offline demo weather; omit for live Open-Meteo
# → http://localhost:8080
```

Requires Node.js **20.19+** (22 or 24 recommended: they include SQLite built in; on 20 the optional `better-sqlite3` package is used automatically).

## Commands

| Command | What it does |
|---|---|
| `npm start` | Run the server (`server.js` → `src/main.js`). |
| `npm test` | 200+ unit and integration tests (engine, shopping, security, billing, AI, background removal…). |
| `npm run test:e2e` | Real-browser end-to-end flow on phone and desktop viewports; fails on console errors and CSP violations. `SHOTS=/tmp/shots npm run test:e2e` saves screenshots. |
| `npm run check` | Static gate: syntax, browser import resolution, CSP-clean HTML, manifest and service-worker assets. |
| `node scripts/i18n.mjs check` | Every language has every string, with matching placeholders (also part of `npm run check`). |
| `npm run package` | Build `dist/modaward-<version>.zip` for upload to a host. |
| `npm run backup` | Consistent SQLite backup (safe while running). |
| `npm run catalog:import -- --retailer hm --file feed.csv` | Load an affiliate product feed (see [docs/BUSINESS.md](docs/BUSINESS.md)). |
| `npm run vendor` / `npm run icons` | Rebuild the bundled frontend dependencies / PNG app icons. |

## Documentation

- **[docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md)**: put it live on your Hostinger plan, step by step.
- **[docs/BUSINESS.md](docs/BUSINESS.md)**: how it makes money, what to switch on and in what order, costs, legal checklist.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: how it works and why, including the outfit engine and security model.
- **[docs/API.md](docs/API.md)**: HTTP API reference.

## Project layout

```
server.js            startup file for hosts (loads src/main.js)
src/
  engine/            outfit engine: thermal model, colour harmony, scoring, planner
  shop/              looks, retailer assignment, closet gaps, feed importer, signed links
  ai/                taste model, Claude stylist + vision, style insights
  services/          weather, auth helpers, images, billing, mail, usage caps
  http/              Express middleware and routes
  db/                SQLite driver adapter + migrations
  repo/              all SQL, scoped by user
  shared/            code used by both server and browser (taxonomy, colour, cut-out, profile)
public/              the PWA: js/ (Preact + htm modules), css/, icons, service worker
test/                unit, integration, and e2e tests
scripts/             packaging, backup, feed import, quality gate
```

## Honest notes

- **Weather licensing.** Open-Meteo's free tier is for non-commercial use. Take their commercial plan (or swap the provider in `src/services/weather.js`) before charging customers.
- **Product data.** ModaWard never scrapes retailers or invents products. Without a feed it shows illustrated looks with real retailer-search links; load an affiliate product feed to show real product photos and prices.
- **Integrations I could not test live.** Open-Meteo, Stripe, Anthropic and remove.bg calls are tested against their documented request and response shapes with fakes, because the build environment had no network access to them or your keys. Run `npm run live:check` once on the server: it exercises each integration you have configured with your real keys and tells you exactly what works.
