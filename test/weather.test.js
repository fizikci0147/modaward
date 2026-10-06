import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpenMeteo, openMeteoProvider, createWeatherService, mockProvider } from '../src/services/weather.js';

/** Shape mirrors the documented Open-Meteo response, including nulls at the horizon edge. */
function openMeteoFixture() {
  const times = [];
  for (const d of ['2026-10-06', '2026-10-07']) for (let h = 0; h < 24; h++) times.push(`${d}T${String(h).padStart(2, '0')}:00`);
  const n = times.length;
  const series = (fn) => Array.from({ length: n }, (_, i) => fn(i));
  return {
    latitude: 40.71,
    longitude: -74.01,
    timezone: 'America/New_York',
    current: { time: '2026-10-06T14:45', temperature_2m: 17.2, apparent_temperature: 15.9, weather_code: 3, precipitation: 0, wind_speed_10m: 12.4, is_day: 1 },
    hourly: {
      time: times,
      temperature_2m: series((i) => 10 + (i % 24) / 3),
      apparent_temperature: series((i) => 9 + (i % 24) / 3),
      precipitation_probability: series((i) => (i > 40 ? null : 20)),
      precipitation: series(() => 0),
      weather_code: series(() => 3),
      wind_speed_10m: series(() => 11),
      uv_index: series((i) => (i % 24 >= 10 && i % 24 <= 15 ? 4 : 0))
    },
    daily: {
      time: ['2026-10-05', '2026-10-06', '2026-10-07'],
      weather_code: [61, 3, 80],
      temperature_2m_max: [16, 18, 19],
      temperature_2m_min: [9, 8, 10],
      apparent_temperature_max: [14, 17, 18],
      apparent_temperature_min: [7, 6, null],
      precipitation_sum: [4, 0, 6.2],
      precipitation_probability_max: [80, 15, null],
      wind_speed_10m_max: [20, 15, 30],
      uv_index_max: [3, 4, 2],
      sunrise: ['2026-10-05T06:55', '2026-10-06T06:56', '2026-10-07T06:57'],
      sunset: ['2026-10-05T18:10', '2026-10-06T18:08', '2026-10-07T18:07']
    }
  };
}

describe('Open-Meteo normalisation', () => {
  test('maps fields, tolerates nulls and drops days before today', () => {
    const w = normalizeOpenMeteo(openMeteoFixture(), { name: 'NYC' });
    assert.equal(w.today, '2026-10-06');
    assert.equal(w.nowHour, 14);
    assert.deepEqual(w.days.map((d) => d.date), ['2026-10-06', '2026-10-07']);
    const d1 = w.days[1];
    assert.equal(d1.precipProb, 0); // null → 0
    assert.equal(d1.feelsMinC, 10); // null apparent min falls back to air temperature
    assert.equal(d1.hours.length, 24);
    assert.equal(w.current.isDay, true);
    assert.equal(w.location.timezone, 'America/New_York');
  });

  test('rejects responses with no daily data', () => {
    assert.throws(() => normalizeOpenMeteo({ hourly: {} }), /no daily data/);
  });
});

describe('Open-Meteo provider', () => {
  test('builds the documented request and parses the response', async () => {
    let seen;
    const fetch = async (url) => {
      seen = new URL(url);
      return { ok: true, status: 200, json: async () => openMeteoFixture() };
    };
    const p = openMeteoProvider({ fetch });
    const w = await p.forecast({ lat: 40.7128, lon: -74.006 });
    assert.equal(seen.origin + seen.pathname, 'https://api.open-meteo.com/v1/forecast');
    assert.equal(seen.searchParams.get('timezone'), 'auto');
    assert.match(seen.searchParams.get('hourly'), /apparent_temperature/);
    assert.match(seen.searchParams.get('daily'), /precipitation_probability_max/);
    assert.equal(seen.searchParams.get('apikey'), null);
    assert.equal(w.days.length, 2);
  });

  test('a commercial key switches to the customer endpoint', async () => {
    let seen;
    const fetch = async (url) => {
      seen = new URL(url);
      return { ok: true, status: 200, json: async () => openMeteoFixture() };
    };
    await openMeteoProvider({ fetch, apiKey: 'secret' }).forecast({ lat: 1, lon: 2 });
    assert.equal(seen.hostname, 'customer-api.open-meteo.com');
    assert.equal(seen.searchParams.get('apikey'), 'secret');
  });

  test('retries once on server errors then succeeds', async () => {
    let calls = 0;
    const fetch = async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 503 } : { ok: true, status: 200, json: async () => openMeteoFixture() };
    };
    await openMeteoProvider({ fetch }).forecast({ lat: 1, lon: 2 });
    assert.equal(calls, 2);
  });

  test('geocoding maps results to display names', async () => {
    const fetch = async () => ({ ok: true, status: 200, json: async () => ({ results: [{ name: 'Istanbul', admin1: 'Istanbul', country_code: 'TR', latitude: 41, longitude: 29, timezone: 'Europe/Istanbul' }] }) });
    const r = await openMeteoProvider({ fetch }).geocode('istanbul');
    assert.deepEqual(r, [{ name: 'Istanbul, Istanbul, TR', lat: 41, lon: 29, timezone: 'Europe/Istanbul' }]);
  });

  test('geocoding with no results returns an empty list', async () => {
    const fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
    assert.deepEqual(await openMeteoProvider({ fetch }).geocode('zzzz'), []);
  });
});

describe('weather service cache', () => {
  const fakeProvider = (impl) => ({ name: 'fake', forecast: impl, geocode: async () => [] });

  test('serves repeat requests from cache and shares in-flight calls', async () => {
    let calls = 0;
    const svc = createWeatherService({ provider: fakeProvider(async () => { calls += 1; await new Promise((r) => setTimeout(r, 10)); return normalizeOpenMeteo(openMeteoFixture()); }) });
    await Promise.all([svc.forecast({ lat: 40.711, lon: -74.011 }), svc.forecast({ lat: 40.712, lon: -74.009 })]);
    await svc.forecast({ lat: 40.71, lon: -74.01 });
    assert.equal(calls, 1);
  });

  test('refetches after the TTL', async () => {
    let calls = 0;
    let t = 0;
    const svc = createWeatherService({ cacheMinutes: 1, now: () => t, provider: fakeProvider(async () => { calls += 1; return normalizeOpenMeteo(openMeteoFixture()); }) });
    await svc.forecast({ lat: 1, lon: 1 });
    t = 61_000;
    await svc.forecast({ lat: 1, lon: 1 });
    assert.equal(calls, 2);
  });

  test('serves stale data when the provider fails, flagged as stale', async () => {
    let fail = false;
    let t = 0;
    const svc = createWeatherService({ cacheMinutes: 1, now: () => t, provider: fakeProvider(async () => { if (fail) throw new Error('down'); return normalizeOpenMeteo(openMeteoFixture()); }) });
    await svc.forecast({ lat: 1, lon: 1 });
    fail = true;
    t = 120_000;
    const w = await svc.forecast({ lat: 1, lon: 1 });
    assert.equal(w.stale, true);
  });

  test('with no cached copy a provider failure becomes a clean 503', async () => {
    const svc = createWeatherService({ provider: fakeProvider(async () => { throw new Error('down'); }) });
    await assert.rejects(svc.forecast({ lat: 1, lon: 1 }), (e) => e.status === 503 && e.code === 'weather_unavailable');
  });

  test('a location name is attached per request without leaking between users', async () => {
    const svc = createWeatherService({ provider: fakeProvider(async () => normalizeOpenMeteo(openMeteoFixture())) });
    const a = await svc.forecast({ lat: 1, lon: 1, name: 'Home' });
    const b = await svc.forecast({ lat: 1, lon: 1, name: 'Work' });
    assert.equal(a.location.name, 'Home');
    assert.equal(b.location.name, 'Work');
  });
});

describe('mock provider', () => {
  test('is deterministic and produces eight days with a rainy day', async () => {
    const clock = () => new Date('2026-10-06T10:00:00Z');
    const a = await mockProvider({ clock }).forecast({ lat: 40.7, lon: -74 });
    const b = await mockProvider({ clock }).forecast({ lat: 40.7, lon: -74 });
    assert.deepEqual(a, b);
    assert.equal(a.days.length, 8);
    assert.ok(a.days.some((d) => d.precipProb >= 70));
  });
});
