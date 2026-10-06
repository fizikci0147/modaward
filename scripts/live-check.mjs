#!/usr/bin/env node
/**
 * Live smoke test for every external integration, using the keys in your environment/.env.
 *   npm run live:check
 * Nothing is charged: it makes read-only or tiny calls. Integrations without a key are skipped.
 */
import { loadConfig } from '../src/config.js';
import { openMeteoProvider } from '../src/services/weather.js';
import { createUsage } from '../src/services/usage.js';
import { openDb } from '../src/db/index.js';
import { createAiClient } from '../src/ai/client.js';

const config = loadConfig();
let failed = 0;
const row = (ok, name, detail = '') => {
  if (ok === false) failed += 1;
  console.log(`${ok === null ? '–' : ok ? '✔' : '✖'} ${name}${detail ? `: ${detail}` : ''}`);
};

// Weather
try {
  const p = openMeteoProvider({ apiKey: config.weather.apiKey });
  const w = await p.forecast({ lat: 40.7128, lon: -74.006 });
  const geo = await p.geocode('Istanbul');
  row(true, 'Open-Meteo forecast', `${w.days.length} days, today ${Math.round(w.days[0].tMaxC)}°C max${config.weather.apiKey ? ' (commercial endpoint)' : ' (free, non-commercial endpoint)'}`);
  row(geo.length > 0, 'Open-Meteo city search', geo[0]?.name ?? 'no results');
} catch (e) {
  row(false, 'Open-Meteo', e.message);
}

// Claude
if (config.ai.apiKey) {
  const db = await openDb(':memory:');
  db.run("INSERT INTO users (id,email,password_hash,created_at) VALUES ('u','a@b.co','x',0)");
  const log = { info() {}, warn: (e, f) => console.log('   ', e, JSON.stringify(f)), error() {} };
  const ai = await createAiClient(config, createUsage(db), log);
  const out = await ai.askJson({
    user: { id: 'u' },
    kind: 'live_check',
    system: 'You are a connectivity check. Reply with JSON only.',
    content: [{ type: 'text', text: 'Return {"ok": true, "word": "wardrobe"}' }],
    schema: { type: 'object', properties: { ok: { type: 'boolean' }, word: { type: 'string' } }, required: ['ok', 'word'], additionalProperties: false },
    maxTokens: 1500
  });
  row(Boolean(out?.ok), `Anthropic (${config.ai.model})`, out ? JSON.stringify(out) : 'no valid answer: see the warning above (wrong key, model name or network?)');
  db.close();
} else row(null, 'Anthropic', 'ANTHROPIC_API_KEY not set (AI stylist stays off)');

// Stripe
if (config.stripe.secretKey) {
  const get = async (path) => {
    const res = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${config.stripe.secretKey}` } });
    return { ok: res.ok, json: await res.json().catch(() => ({})) };
  };
  const live = config.stripe.secretKey.startsWith('sk_live') || config.stripe.secretKey.startsWith('rk_live');
  for (const [label, id] of [['monthly price', config.stripe.priceMonthly], ['yearly price', config.stripe.priceYearly]]) {
    if (!id) row(false, `Stripe ${label}`, 'not set');
    else {
      const r = await get(`/prices/${encodeURIComponent(id)}`);
      row(r.ok && r.json.active && r.json.type === 'recurring', `Stripe ${label}`, r.ok ? `${(r.json.unit_amount / 100).toFixed(2)} ${r.json.currency?.toUpperCase()} / ${r.json.recurring?.interval}${live ? '' : ' (TEST mode)'}` : r.json.error?.message);
    }
  }
  row(Boolean(config.stripe.webhookSecret), 'Stripe webhook secret', config.stripe.webhookSecret ? 'set; point the webhook at /api/billing/webhook' : 'STRIPE_WEBHOOK_SECRET not set: upgrades will never be applied');
} else row(null, 'Stripe', 'STRIPE_SECRET_KEY not set (Pro checkout stays off)');

// remove.bg
if (config.cutout.apiKey) {
  const res = await fetch('https://api.remove.bg/v1.0/account', { headers: { 'X-Api-Key': config.cutout.apiKey } });
  const j = await res.json().catch(() => ({}));
  row(res.ok, 'remove.bg', res.ok ? `${j.data?.attributes?.credits?.total ?? '?'} credits` : j.errors?.[0]?.title);
} else row(null, 'remove.bg', 'REMOVEBG_API_KEY not set (browser background removal still works)');

// SMTP
if (config.smtp.host && config.smtp.user) {
  try {
    const nodemailer = (await import('nodemailer')).default;
    await nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, auth: { user: config.smtp.user, pass: config.smtp.pass } }).verify();
    row(true, 'SMTP login', `${config.smtp.host}:${config.smtp.port}`);
  } catch (e) {
    row(false, 'SMTP login', e.message);
  }
} else row(null, 'SMTP', 'not configured (password-reset emails are only logged)');

row(Boolean(config.appUrl) || !config.production, 'APP_URL', config.appUrl || (config.production ? 'REQUIRED in production' : 'not set (fine for local development)'));
console.log(failed ? `\n${failed} check(s) failed` : '\nAll configured integrations are working.');
process.exit(failed ? 1 : 0);
