import { loadLocales } from './i18n/index.js';
import path from 'node:path';
import { createTrendService } from './services/trends.js';
import { openDb } from './db/index.js';
import { createRepos } from './repo/index.js';
import { createLogger } from './log.js';
import { createImageStore } from './services/images.js';
import { createMailer } from './services/mailer.js';
import { createWeatherService, openMeteoProvider, mockProvider } from './services/weather.js';
import { createOutfitService } from './services/outfits.js';
import { createShopService } from './services/shop.js';
import { createCodes } from './services/codes.js';
import { createUsage } from './services/usage.js';
import { createCutoutService } from './services/cutout.js';
import { createBilling } from './services/billing.js';
import { persistentSecret } from './services/secrets.js';
import { createLinker } from './shop/links.js';
import { customRetailer, CUSTOM_PREFIX } from './shop/retailers.js';
import { createCatalog } from './shop/catalog.js';
import { createAiClient } from './ai/client.js';
import { createStylist } from './ai/stylist.js';
import { createPush } from './services/push.js';
import { createReminders } from './services/reminders.js';
import { reminderRoutes } from './http/routes/reminders.js';
import { clientErrorRoutes } from './http/routes/client-errors.js';
import { shopRoutes } from './http/routes/shop.js';
import { photoRoutes } from './http/routes/photos.js';
import { billingRoutes } from './http/routes/billing.js';
import { aiRoutes } from './http/routes/ai.js';
import { insightsRoutes } from './http/routes/insights.js';
import { adminRoutes } from './http/routes/admin.js';
import { createApp } from './app.js';

/**
 * Build every dependency and the Express app. `overrides` lets tests substitute pieces.
 * @param {import('./config.js').Config} config
 */
export async function createDeps(config, overrides = {}) {
  const log = overrides.log ?? createLogger({ level: config.production ? 'info' : 'warn' });
  const db = overrides.db ?? (await openDb(overrides.dbFile ?? path.join(config.dataDir, 'modaward.db')));
  await loadLocales(log);
  const repos = createRepos(db);
  const images = overrides.images ?? createImageStore(config.dataDir);
  const mailer = overrides.mailer ?? createMailer(config, log);
  const usage = createUsage(db);

  const provider = overrides.weatherProvider ?? (config.weather.provider === 'mock' ? mockProvider() : openMeteoProvider({ apiKey: config.weather.apiKey }));
  const weather = createWeatherService({ provider, cacheMinutes: config.weather.cacheMinutes, log });
  // a store a person added is looked up by id when one of their links is followed (the link's signature, made by us, is what vouches for it)
  const resolveCustom = (id) => {
    if (!id.startsWith(CUSTOM_PREFIX)) return null;
    const row = repos.customStores.get(Number(id.slice(CUSTOM_PREFIX.length)));
    return row ? customRetailer(row) : null;
  };
  const linker = createLinker({ secret: persistentSecret(config.dataDir, 'link', config.linkSecret), affiliates: overrides.affiliates ?? {}, resolve: resolveCustom });
  const catalog = createCatalog(db);

  // optional integrations: each is null when its key is absent, and the app degrades gracefully
  const ai = await createAiClient(config, usage, log, overrides.aiClient);
  const stylist = ai ? createStylist({ ai, db, log }) : null;
  const cutoutService = overrides.cutoutService === undefined ? createCutoutService(config, usage, log, overrides.fetch) : overrides.cutoutService;
  // nothing is sold in the free version, so there is no billing at all (even if Stripe keys are present)
  const billing = overrides.billing === undefined ? (config.plans.pricing === 'paid' ? createBilling(config, repos, log, overrides.fetch) : null) : overrides.billing;

  const capabilities = {
    ai: Boolean(stylist),
    vision: Boolean(stylist),
    cutoutService: Boolean(cutoutService),
    billing: Boolean(billing && (config.stripe.priceMonthly || config.stripe.priceYearly)),
    // who runs this site, shown in the privacy policy (set OPERATOR_NAME and CONTACT_EMAIL)
    operator: config.operator,
    // the free Pro period new members get, so the sign-up screens can say so (0 = no offer)
    promo: { proDays: config.plans.signupProDays },
    // 'free': everything is free and the app shows no Pro anywhere; 'paid': Free and Pro plans
    pricing: config.plans.pricing
  };

  // trend lists: the saved ones (written by the monthly refresh, or by hand: docs/TRENDS.md) override the built-in ones
  const trends = createTrendService({ config, ai, log });
  trends.load();

  const codes = createCodes({ db, repos });
  // what day it is for date checks (tests pin it to the same day as the mock weather)
  const clock = overrides.clock ?? (() => new Date());
  const deps = { config, db, repos, codes, trends, log, clock, images, mailer, weather, linker, catalog, usage, stylist, cutoutService, billing, capabilities, extraApiRoutes: [] };
  deps.outfits = createOutfitService({ repos, weather, config, stylist });
  deps.shop = createShopService({ repos, weather, catalog, linker, config, stylist });
  deps.push = overrides.push === undefined ? await createPush(config, db, log, overrides.pushSender) : overrides.push;
  deps.reminders = createReminders({ db, repos, outfits: deps.outfits, push: deps.push, mailer, config, log, secret: persistentSecret(config.dataDir, 'reminders') });
  capabilities.push = Boolean(deps.push);
  for (const routes of [shopRoutes, photoRoutes, billingRoutes, aiRoutes, insightsRoutes, adminRoutes, reminderRoutes, clientErrorRoutes]) deps.extraApiRoutes.push((api) => api.use(routes(deps)));
  return deps;
}

export async function createServer(config, overrides = {}) {
  const deps = await createDeps(config, overrides);
  return { app: createApp(deps), deps };
}
