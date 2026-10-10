/**
 * Environment configuration. Everything is optional except where noted: the app boots with
 * zero configuration, and each integration (AI, Stripe, SMTP…) switches on when its keys exist.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Load `.env` from the app root if present (Node ≥ 20.12 has loadEnvFile). Real env wins. */
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file) || typeof process.loadEnvFile !== 'function') return;
  const before = { ...process.env };
  process.loadEnvFile(file);
  for (const [k, v] of Object.entries(before)) process.env[k] = v;
}

const bool = (v, fallback = false) => (v == null || v === '' ? fallback : /^(1|true|yes|on)$/i.test(String(v)));
const int = (v, fallback) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};
const str = (v, fallback = '') => (v == null ? fallback : String(v).trim());

/** Written by `npm run package`: which build is this? Missing in development. */
function readBuild() {
  try {
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'BUILD.json'), 'utf8'));
    return { id: String(b.id), builtAt: String(b.builtAt) };
  } catch {
    return { id: 'development', builtAt: null };
  }
}

function resolveDataDir(explicit) {
  const candidates = explicit ? [explicit] : [path.join(os.homedir(), 'modaward-data'), path.join(ROOT, 'data')];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.accessSync(dir, fs.constants.W_OK);
      // inside the app folder, a redeploy from a zip replaces the data with the new release
      if (!explicit && dir.startsWith(ROOT)) console.warn(`ModaWard: DATA_DIR is not set and ${path.join(os.homedir(), 'modaward-data')} is not usable, so data is being kept inside the app folder (${dir}). A redeploy can wipe it: set DATA_DIR to a folder outside the app.`);
      return path.resolve(dir);
    } catch {
      /* try the next location */
    }
  }
  throw new Error(`No writable data directory. Set DATA_DIR to a folder the app may write to (tried: ${candidates.join(', ')}).`);
}

/** "yourdomain.com" is a common way to fill this in: assume https. Anything unusable stops the start with a clear message. */
function normalizeAppUrl(raw) {
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`APP_URL is not a web address: "${raw}". Use the full address of your site, for example https://modaward.example.com`);
  }
  if (url.pathname.replace(/\/+$/, '') || url.search || url.hash) throw new Error(`APP_URL must be just the site address (no path), for example https://modaward.example.com, not "${raw}".`);
  return url.origin;
}

/** @param {NodeJS.ProcessEnv} [env] */
export function loadConfig(env = process.env, { dotenv = env === process.env } = {}) {
  if (dotenv) loadDotEnv();
  const production = str(env.NODE_ENV) === 'production';
  const trust = str(env.TRUST_PROXY, production ? '1' : '');
  const appUrl = normalizeAppUrl(str(env.APP_URL));

  return Object.freeze({
    root: ROOT,
    production,
    version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
    build: readBuild(),
    port: int(env.PORT, 8080),
    host: str(env.HOST, '0.0.0.0'),
    trustProxy: /^\d+$/.test(trust) ? Number(trust) : bool(trust) ? 1 : false,
    appUrl,
    allowedOrigins: str(env.ALLOWED_ORIGINS)
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/\/+$/, ''))
      .filter(Boolean),
    dataDir: resolveDataDir(str(env.DATA_DIR) || null),
    publicDir: path.join(ROOT, 'public'),
    sharedDir: path.join(ROOT, 'src', 'shared'),

    limits: { auth: int(env.AUTH_RATE_MAX, 20), api: int(env.API_RATE_MAX, 400) },
    operator: { name: str(env.OPERATOR_NAME), email: str(env.CONTACT_EMAIL) },
    adminEmails: str(env.ADMIN_EMAILS).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    registrationOpen: bool(env.ALLOW_REGISTRATION, true),
    sessionDays: int(env.SESSION_DAYS, 30),
    logMailBodies: bool(env.LOG_MAIL_BODIES, !production),

    weather: {
      provider: str(env.WEATHER_PROVIDER, 'openmeteo'),
      apiKey: str(env.OPEN_METEO_API_KEY),
      cacheMinutes: int(env.WEATHER_CACHE_MINUTES, 20)
    },

    ai: {
      apiKey: str(env.ANTHROPIC_API_KEY),
      model: str(env.AI_MODEL, 'claude-opus-5-5'),
      dailyLimitPerUser: int(env.AI_DAILY_LIMIT, 12),
      dailyLimitGlobal: int(env.AI_GLOBAL_DAILY_LIMIT, 2000)
    },

    push: {
      enabled: bool(env.PUSH_ENABLED, true),
      publicKey: str(env.VAPID_PUBLIC_KEY),
      privateKey: str(env.VAPID_PRIVATE_KEY),
      subject: str(env.VAPID_SUBJECT)
    },

    reminders: { enabled: bool(env.REMINDERS_ENABLED, true), intervalSeconds: int(env.REMINDERS_INTERVAL_SECONDS, 300) },

    cutout: {
      apiKey: str(env.REMOVEBG_API_KEY),
      size: str(env.REMOVEBG_SIZE, 'regular'),
      dailyLimitPerUser: int(env.CUTOUT_DAILY_LIMIT, 30)
    },

    plans: {
      freeClosetLimit: int(env.FREE_CLOSET_LIMIT, 30),
      freeLooksPerWeek: int(env.FREE_SHOP_LOOKS, 6)
    },

    stripe: {
      secretKey: str(env.STRIPE_SECRET_KEY),
      webhookSecret: str(env.STRIPE_WEBHOOK_SECRET),
      priceMonthly: str(env.STRIPE_PRICE_MONTHLY),
      priceYearly: str(env.STRIPE_PRICE_YEARLY)
    },

    smtp: {
      host: str(env.SMTP_HOST),
      port: int(env.SMTP_PORT, 465),
      secure: bool(env.SMTP_SECURE, int(env.SMTP_PORT, 465) === 465),
      user: str(env.SMTP_USER),
      pass: str(env.SMTP_PASS),
      from: str(env.SMTP_FROM, 'ModaWard <no-reply@localhost>')
    },

    affiliateFile: str(env.AFFILIATE_CONFIG),
    linkSecret: str(env.LINK_SECRET)
  });
}

/** @typedef {ReturnType<typeof loadConfig>} Config */
