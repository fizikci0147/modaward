import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { requestContext, securityHeaders, csrf, rateLimit, sessionAuth, errorHandler } from './http/middleware.js';
import { authRoutes } from './http/routes/auth.js';
import { accountRoutes } from './http/routes/account.js';
import { profileRoutes } from './http/routes/profile.js';
import { garmentRoutes, uploadsRoute } from './http/routes/garments.js';
import { outfitRoutes } from './http/routes/outfits.js';
import { goRoute } from './http/routes/go.js';
import { notFound } from './util/errors.js';

const LONG_CACHE = 'public, max-age=86400';

/**
 * Build the Express app from explicit dependencies (no globals), so tests can run the whole
 * stack against an in-memory database and fake weather.
 *
 * @param {object} deps
 * @param {import('./config.js').Config} deps.config
 * @param {ReturnType<import('./repo/index.js').createRepos>} deps.repos
 * @param {object} deps.log
 * @param {object} deps.weather
 * @param {object} deps.images
 * @param {object} deps.mailer
 * @param {object} deps.outfits
 * @param {object} [deps.linker]
 * @param {Function[]} [deps.extraApiRoutes]  extra `(api) => void` mounters (shop, billing, AI, admin)
 * @param {object} [deps.billing]
 */
export function createApp(deps) {
  const { config, repos, log } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('etag', 'strong');

  app.use(requestContext(log));
  app.use(securityHeaders(config));
  app.use(compression());

  app.get('/health', (_req, res) => res.json({ ok: true, version: config.version, uptime: Math.round(process.uptime()) }));
  app.get('/ready', (_req, res) => {
    try {
      repos.db.get('SELECT 1 AS ok');
      res.json({ ok: true, db: repos.db.driver });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  // Stripe needs the untouched body to verify its signature, so it is mounted before JSON parsing.
  if (deps.billing) app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }), deps.billing.webhook);

  // ── static assets ──
  const staticOpts = { index: false, etag: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') };
  app.use('/shared', express.static(config.sharedDir, { ...staticOpts, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  app.use(
    express.static(config.publicDir, {
      ...staticOpts,
      setHeaders(res, file) {
        const rel = path.relative(config.publicDir, file);
        if (/^(icons|vendor)[\\/]/.test(rel)) res.setHeader('Cache-Control', LONG_CACHE);
        else res.setHeader('Cache-Control', 'no-cache');
        if (rel === 'sw.js') res.setHeader('Service-Worker-Allowed', '/');
      }
    })
  );

  // ── authenticated files and redirects ──
  app.get('/uploads/:name', sessionAuth(repos), uploadsRoute(deps));
  if (deps.linker) app.get('/go', sessionAuth(repos), goRoute(deps));

  // ── API ──
  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, max: config.limits.api, message: 'Too many requests. Please slow down.' }));
  api.use(sessionAuth(repos));
  const big = express.json({ limit: '5mb' });
  const small = express.json({ limit: '100kb' });
  api.use((req, res, next) => (/^\/(garments|ai)(\/|$)/.test(req.path) ? big : small)(req, res, next));
  api.use(csrf(config));

  api.use('/auth', authRoutes({ ...deps, capabilities: deps.capabilities ?? {} }));
  api.use(accountRoutes(deps));
  api.use(profileRoutes(deps));
  api.use(garmentRoutes(deps));
  api.use(outfitRoutes(deps));
  for (const mount of deps.extraApiRoutes ?? []) mount(api);
  api.use((_req, _res, next) => next(notFound('That API endpoint does not exist.')));
  app.use('/api', api);

  // ── single-page app fallback ──
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || path.extname(req.path) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });
  app.use((_req, res) => res.status(404).type('text/plain').send('Not found'));

  app.use(errorHandler(log));
  return app;
}
