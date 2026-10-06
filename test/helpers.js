import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { createServer } from '../src/bootstrap.js';
import { createLogger } from '../src/log.js';
import { mockProvider } from '../src/services/weather.js';

/** Boot the real app on an ephemeral port with an in-memory DB and deterministic weather. */
export async function startTestServer({ env = {}, overrides = {} } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-test-'));
  const config = loadConfig({ DATA_DIR: dataDir, NODE_ENV: 'test', WEATHER_PROVIDER: 'mock', AUTH_RATE_MAX: '10000', API_RATE_MAX: '100000', ...env }, { dotenv: false });
  const logs = [];
  const log = createLogger({ level: 'warn', sink: (l) => logs.push(JSON.parse(l)) });
  const clock = () => new Date('2026-10-06T10:00:00Z');
  const { app, deps } = await createServer(config, {
    log,
    dbFile: ':memory:',
    weatherProvider: mockProvider({ clock }),
    ...overrides
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  /** A tiny cookie-keeping API client that sends the CSRF header like the real frontend. */
  function client() {
    let cookie = '';
    const call = async (method, url, body, headers = {}) => {
      const res = await fetch(base + url, {
        method,
        redirect: 'manual',
        headers: { 'content-type': 'application/json', 'x-requested-with': 'modaward', ...(cookie ? { cookie } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const set = res.headers.get('set-cookie');
      if (set) {
        const pair = set.split(';')[0];
        cookie = pair.endsWith('=') ? '' : pair;
      }
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      return { status: res.status, json, text, headers: res.headers };
    };
    return {
      get: (u, h) => call('GET', u, undefined, h),
      post: (u, b = {}, h) => call('POST', u, b, h),
      put: (u, b = {}, h) => call('PUT', u, b, h),
      patch: (u, b = {}, h) => call('PATCH', u, b, h),
      del: (u, b, h) => call('DELETE', u, b, h),
      raw: call,
      get cookie() {
        return cookie;
      }
    };
  }

  return {
    base,
    deps,
    config,
    logs,
    client,
    async close() {
      await new Promise((r) => server.close(r));
      deps.db.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  };
}

let counter = 0;
export async function registerUser(c, overrides = {}) {
  counter += 1;
  const email = overrides.email || `user${counter}-${Date.now()}@example.com`;
  const res = await c.post('/api/auth/register', { email, password: 'correct horse battery', name: 'Test User', ...overrides });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.text}`);
  return { email, password: overrides.password ?? 'correct horse battery', user: res.json.user };
}

export const NYC = { name: 'New York, NY, US', lat: 40.7128, lon: -74.006, timezone: 'America/New_York' };
