import { localeMiddleware } from './i18n/index.js';
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
import { createAssets } from './http/assets.js';

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
  app.locals.production = config.production;

  app.use(requestContext(log));
  app.use(securityHeaders(config));
  app.use(compression());
  app.use(localeMiddleware);

  app.get('/health', (_req, res) => res.json({ ok: true, version: config.version, build: config.build.id, uptime: Math.round(process.uptime()) }));
  app.get('/ready', (_req, res) => {
    try {
      repos.db.get('SELECT 1 AS ok');
      res.json({ ok: true, db: repos.db.driver });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  // Stripe needs the untouched body to verify its signature, so it is mounted before JSON parsing.
  if (deps.billing) app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '256kb' }), deps.billing.webhook);

  // ── static assets ──
  const staticOpts = { index: false, etag: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') };
  // Scripts and styles live under /v/<build>/ so no cache can serve an old release (see http/assets.js).
  // The service worker's cache name carries the build id too, so every release invalidates old caches by itself.
  const assets = createAssets(config);
  const swBody = assets.serviceWorker();
  app.get('/sw.js', (_req, res) => res.type('application/javascript').set('Cache-Control', 'no-cache').send(swBody));
  app.use(assets.versioned);
  app.use(assets.plain);
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
  if (deps.linker) app.get('/go', rateLimit({ windowMs: 60_000, max: 120, message: 'Too many requests. Please slow down.' }), sessionAuth(repos), goRoute(deps));

  // ── API ──
  const api = express.Router();
  // Responses depend on who is signed in: no proxy, CDN or browser may store or share them.
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie');
    next();
  });
  api.use(rateLimit({ windowMs: 60_000, max: config.limits.api, message: 'Too many requests. Please slow down.' }));
  api.use(sessionAuth(repos));
  const big = express.json({ limit: '5mb' });
  const small = express.json({ limit: '100kb' });
  const huge = express.json({ limit: '12mb' }); // admin feed imports only
  // big bodies are only read for signed-in people (and the 12 MB feed import only for admins), so an
  // anonymous visitor cannot make the server buffer megabytes before being told to sign in
  const parserFor = (req) => {
    if (!req.user) return small;
    if (req.path === '/admin/products/import') return config.adminEmails.includes(req.user.email.toLowerCase()) ? huge : small;
    return /^\/(garments|ai|photos)(\/|$)/.test(req.path) ? big : small;
  };
  api.use((req, res, next) => parserFor(req)(req, res, next));
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
    // dotfile probes (/.env, /.git/config) get a plain 404, never the app shell
    if ((req.method !== 'GET' && req.method !== 'HEAD') || path.extname(req.path) || /(^|\/)\./.test(req.path) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(assets.indexHtml());
  });
  app.use((_req, res) => res.status(404).type('text/plain').send('Not found'));

  app.use(errorHandler(log));
  return app;
}
