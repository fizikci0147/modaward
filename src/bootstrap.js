import path from 'node:path';
import { openDb } from './db/index.js';
import { createRepos } from './repo/index.js';
import { createLogger } from './log.js';
import { createImageStore } from './services/images.js';
import { createMailer } from './services/mailer.js';
import { createWeatherService, openMeteoProvider, mockProvider } from './services/weather.js';
import { createOutfitService } from './services/outfits.js';
import { persistentSecret } from './services/secrets.js';
import { createLinker } from './shop/links.js';
import { createApp } from './app.js';

/**
 * Build every dependency and the Express app. `overrides` lets tests substitute pieces.
 * @param {import('./config.js').Config} config
 */
export async function createDeps(config, overrides = {}) {
  const log = overrides.log ?? createLogger({ level: config.production ? 'info' : 'warn' });
  const db = overrides.db ?? (await openDb(overrides.dbFile ?? path.join(config.dataDir, 'modaward.db')));
  const repos = createRepos(db);
  const images = overrides.images ?? createImageStore(config.dataDir);
  const mailer = overrides.mailer ?? createMailer(config, log);

  const provider = overrides.weatherProvider ?? (config.weather.provider === 'mock' ? mockProvider() : openMeteoProvider({ apiKey: config.weather.apiKey }));
  const weather = createWeatherService({ provider, cacheMinutes: config.weather.cacheMinutes });

  const linker = createLinker({ secret: persistentSecret(config.dataDir, 'link', config.linkSecret), affiliates: overrides.affiliates ?? {} });

  const deps = { config, db, repos, log, images, mailer, weather, linker, extraApiRoutes: [], capabilities: {}, ...overrides.extra };
  deps.outfits = createOutfitService({ repos, weather, config, stylist: deps.stylist ?? null });
  return deps;
}

export async function createServer(config, overrides = {}) {
  const deps = await createDeps(config, overrides);
  return { app: createApp(deps), deps };
}
