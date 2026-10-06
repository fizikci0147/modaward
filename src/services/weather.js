/**
 * Weather and geocoding.
 *
 * The forecast is always requested and cached in metric units (°C, mm, km/h); the engine works
 * in °C and the UI converts for display. Providers are swappable: `openmeteo` (default) or
 * `mock` (deterministic synthetic data for development and tests).
 *
 * NOTE: Open-Meteo's free endpoint is licensed for non-commercial use. A commercial product
 * needs an API key (OPEN_METEO_API_KEY), which switches requests to their customer endpoint.
 */
import { rng, hashString } from '../engine/rng.js';
import { HttpError } from '../util/errors.js';

const FORECAST_DAYS = 8;

const HOURLY = ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'weather_code', 'wind_speed_10m', 'uv_index'];
const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'uv_index_max',
  'sunrise',
  'sunset'
];
const CURRENT = ['temperature_2m', 'apparent_temperature', 'weather_code', 'precipitation', 'wind_speed_10m', 'is_day'];

const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Convert an Open-Meteo response to the app's shape. Tolerates nulls and short arrays,
 * which the API returns at the edge of the forecast horizon.
 */
export function normalizeOpenMeteo(raw, { name = '' } = {}) {
  const daily = raw?.daily;
  const hourly = raw?.hourly;
  if (!daily?.time?.length) throw new Error('Weather response had no daily data');

  const hoursByDate = new Map();
  for (let i = 0; i < (hourly?.time?.length || 0); i++) {
    const [date, clock] = hourly.time[i].split('T');
    const temp = hourly.temperature_2m?.[i];
    if (temp == null) continue;
    const list = hoursByDate.get(date) || [];
    list.push({
      hour: Number(clock.slice(0, 2)),
      tempC: num(temp),
      feelsC: num(hourly.apparent_temperature?.[i], num(temp)),
      precipProb: num(hourly.precipitation_probability?.[i]),
      precipMm: num(hourly.precipitation?.[i]),
      code: num(hourly.weather_code?.[i]),
      windKph: num(hourly.wind_speed_10m?.[i]),
      uv: num(hourly.uv_index?.[i])
    });
    hoursByDate.set(date, list);
  }

  const days = daily.time.map((date, i) => ({
    date,
    code: num(daily.weather_code?.[i]),
    tMaxC: num(daily.temperature_2m_max?.[i]),
    tMinC: num(daily.temperature_2m_min?.[i]),
    feelsMaxC: num(daily.apparent_temperature_max?.[i], num(daily.temperature_2m_max?.[i])),
    feelsMinC: num(daily.apparent_temperature_min?.[i], num(daily.temperature_2m_min?.[i])),
    precipMm: num(daily.precipitation_sum?.[i]),
    precipProb: num(daily.precipitation_probability_max?.[i]),
    windKphMax: num(daily.wind_speed_10m_max?.[i]),
    uvMax: num(daily.uv_index_max?.[i]),
    sunrise: daily.sunrise?.[i] || null,
    sunset: daily.sunset?.[i] || null,
    hours: hoursByDate.get(date) || []
  }));

  const cur = raw.current;
  const current = cur
    ? {
        time: cur.time,
        tempC: num(cur.temperature_2m),
        feelsC: num(cur.apparent_temperature, num(cur.temperature_2m)),
        code: num(cur.weather_code),
        precipMm: num(cur.precipitation),
        windKph: num(cur.wind_speed_10m),
        isDay: cur.is_day !== 0
      }
    : null;

  const today = current?.time?.slice(0, 10) || days[0].date;
  return {
    location: { lat: raw.latitude, lon: raw.longitude, timezone: raw.timezone || 'UTC', name },
    today,
    nowHour: current?.time ? Number(current.time.slice(11, 13)) : null,
    current,
    days: days.filter((d) => d.date >= today)
  };
}

/** Open-Meteo provider. @param {{fetch?:typeof fetch, apiKey?:string}} opts */
export function openMeteoProvider({ fetch: doFetch = globalThis.fetch, apiKey = '' } = {}) {
  const forecastBase = apiKey ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast';
  const geoBase = apiKey ? 'https://customer-geocoding-api.open-meteo.com/v1/search' : 'https://geocoding-api.open-meteo.com/v1/search';

  async function getJson(url) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await doFetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
        if (res.status >= 500) throw new Error(`upstream ${res.status}`);
        if (!res.ok) throw new HttpError(502, 'weather_failed', 'The weather service rejected the request.');
        return await res.json();
      } catch (e) {
        if (e instanceof HttpError) throw e;
        lastError = e;
      }
    }
    throw lastError;
  }

  return {
    name: 'openmeteo',
    async forecast({ lat, lon }) {
      const q = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lon.toFixed(4),
        timezone: 'auto',
        forecast_days: String(FORECAST_DAYS),
        current: CURRENT.join(','),
        hourly: HOURLY.join(','),
        daily: DAILY.join(',')
      });
      if (apiKey) q.set('apikey', apiKey);
      return normalizeOpenMeteo(await getJson(`${forecastBase}?${q}`));
    },
    async geocode(query) {
      const q = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' });
      if (apiKey) q.set('apikey', apiKey);
      const json = await getJson(`${geoBase}?${q}`);
      return (json.results || []).map((r) => ({
        name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
        lat: r.latitude,
        lon: r.longitude,
        timezone: r.timezone || 'UTC'
      }));
    }
  };
}

const MOCK_CITIES = [
  { name: 'New York, NY, US', lat: 40.7128, lon: -74.006, timezone: 'America/New_York' },
  { name: 'London, England, GB', lat: 51.5072, lon: -0.1276, timezone: 'Europe/London' },
  { name: 'Istanbul, Istanbul, TR', lat: 41.0082, lon: 28.9784, timezone: 'Europe/Istanbul' },
  { name: 'Seattle, WA, US', lat: 47.6062, lon: -122.3321, timezone: 'America/Los_Angeles' },
  { name: 'Los Angeles, CA, US', lat: 34.0522, lon: -118.2437, timezone: 'America/Los_Angeles' },
  { name: 'Chicago, IL, US', lat: 41.8781, lon: -87.6298, timezone: 'America/Chicago' }
];

/** Deterministic synthetic weather. Development and tests only. */
export function mockProvider({ clock = () => new Date() } = {}) {
  return {
    name: 'mock',
    async forecast({ lat, lon }) {
      const start = clock();
      const rand = rng(hashString(`${lat.toFixed(1)},${lon.toFixed(1)}`));
      const base = 6 + rand() * 12;
      const days = [];
      for (let d = 0; d < FORECAST_DAYS; d++) {
        const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + d)).toISOString().slice(0, 10);
        const wet = d === 1 || d === 4;
        const mean = base + Math.sin(d / 2) * 4;
        const min = mean - 4;
        const max = mean + 5;
        const hours = [];
        for (let hour = 0; hour < 24; hour++) {
          const k = Math.cos(((hour - 15) / 24) * 2 * Math.PI);
          const t = mean + 4.5 * k;
          hours.push({ hour, tempC: t, feelsC: t - (wet ? 1.5 : 0.5), precipProb: wet ? 75 : 10, precipMm: wet ? 0.5 : 0, code: wet ? 61 : hour > 10 && hour < 17 ? 2 : 1, windKph: wet ? 22 : 9, uv: hour >= 10 && hour <= 16 ? (wet ? 2 : 5) : 0 });
        }
        days.push({ date, code: wet ? 61 : 2, tMaxC: max, tMinC: min, feelsMaxC: max - 0.5, feelsMinC: min - 1, precipMm: wet ? 9 : 0, precipProb: wet ? 80 : 10, windKphMax: wet ? 28 : 12, uvMax: wet ? 2 : 5, sunrise: `${date}T06:50`, sunset: `${date}T18:40`, hours });
      }
      const nowHour = start.getUTCHours();
      const first = days[0].hours[nowHour];
      return {
        location: { lat, lon, timezone: 'UTC', name: '' },
        today: days[0].date,
        nowHour,
        current: { time: `${days[0].date}T${String(nowHour).padStart(2, '0')}:00`, tempC: first.tempC, feelsC: first.feelsC, code: first.code, precipMm: 0, windKph: first.windKph, isDay: nowHour > 6 && nowHour < 19 },
        days
      };
    },
    async geocode(query) {
      const q = query.toLowerCase();
      return MOCK_CITIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
    }
  };
}

/**
 * Caching layer: short TTL, in-flight de-duplication, and stale-if-error so a provider outage
 * degrades to slightly old weather instead of an empty screen.
 *
 * @param {{provider: ReturnType<typeof openMeteoProvider>, cacheMinutes?: number, staleHours?: number, now?: () => number}} opts
 */
export function createWeatherService({ provider, cacheMinutes = 20, staleHours = 6, now = () => Date.now() }) {
  const cache = new Map();
  const inflight = new Map();
  const geoCache = new Map();

  const keyOf = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

  return {
    provider: provider.name,
    async forecast({ lat, lon, name = '' }) {
      const key = keyOf(lat, lon);
      const hit = cache.get(key);
      if (hit && now() - hit.at < cacheMinutes * 60_000) return { ...hit.data, location: { ...hit.data.location, name }, stale: false };
      if (inflight.has(key)) return inflight.get(key).then((d) => ({ ...d, location: { ...d.location, name } }));

      const p = provider
        .forecast({ lat, lon })
        .then((data) => {
          cache.set(key, { at: now(), data });
          if (cache.size > 500) cache.delete(cache.keys().next().value);
          return { ...data, stale: false };
        })
        .catch((err) => {
          if (hit && now() - hit.at < staleHours * 3_600_000) return { ...hit.data, stale: true };
          throw err instanceof HttpError ? err : new HttpError(503, 'weather_unavailable', 'Weather is temporarily unavailable. Please try again in a minute.');
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
      const data = await p;
      return { ...data, location: { ...data.location, name } };
    },

    async geocode(query) {
      const q = query.trim().toLowerCase();
      if (q.length < 2) return [];
      const hit = geoCache.get(q);
      if (hit && now() - hit.at < 24 * 3_600_000) return hit.data;
      let data;
      try {
        data = await provider.geocode(query.trim());
      } catch {
        throw new HttpError(503, 'geocode_unavailable', 'City search is temporarily unavailable.');
      }
      geoCache.set(q, { at: now(), data });
      if (geoCache.size > 1000) geoCache.delete(geoCache.keys().next().value);
      return data;
    }
  };
}

export { MOCK_CITIES };
