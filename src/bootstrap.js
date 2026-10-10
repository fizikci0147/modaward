import { loadLocales } from './i18n/index.js';
import path from 'node:path';
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
import { createCatalog } from './shop/catalog.js';
import { createAiClient } from './ai/client.js';
import { createStylist } from './ai/stylist.js';
import { createPush } from './services/push.js';
import { createReminders } from './services/reminders.js';
import { reminderRoutes } from './http/routes/reminders.js';
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
  const linker = createLinker({ secret: persistentSecret(config.dataDir, 'link', config.linkSecret), affiliates: overrides.affiliates ?? {} });
  const catalog = createCatalog(db);

  // optional integrations: each is null when its key is absent, and the app degrades gracefully
  const ai = await createAiClient(config, usage, log, overrides.aiClient);
  const stylist = ai ? createStylist({ ai, db, log }) : null;
  const cutoutService = overrides.cutoutService === undefined ? createCutoutService(config, usage, log, overrides.fetch) : overrides.cutoutService;
  const billing = overrides.billing === undefined ? createBilling(config, repos, log, overrides.fetch) : overrides.billing;

  const capabilities = {
    ai: Boolean(stylist),
    vision: Boolean(stylist),
    cutoutService: Boolean(cutoutService),
    billing: Boolean(billing && (config.stripe.priceMonthly || config.stripe.priceYearly))
  };

  const codes = createCodes({ db, repos });
  const deps = { config, db, repos, codes, log, images, mailer, weather, linker, catalog, usage, stylist, cutoutService, billing, capabilities, extraApiRoutes: [] };
  deps.outfits = createOutfitService({ repos, weather, config, stylist });
  deps.shop = createShopService({ repos, weather, catalog, linker, config, stylist });
  deps.push = overrides.push === undefined ? await createPush(config, db, log, overrides.pushSender) : overrides.push;
  deps.reminders = createReminders({ db, repos, outfits: deps.outfits, push: deps.push, mailer, config, log, secret: persistentSecret(config.dataDir, 'reminders') });
  capabilities.push = Boolean(deps.push);
  for (const routes of [shopRoutes, photoRoutes, billingRoutes, aiRoutes, insightsRoutes, adminRoutes, reminderRoutes]) deps.extraApiRoutes.push((api) => api.use(routes(deps)));
  return deps;
}

export async function createServer(config, overrides = {}) {
  const deps = await createDeps(config, overrides);
  return { app: createApp(deps), deps };
}
