/**
 * Food databases behind the calorie tracker at /trackweight.
 *
 * Open Food Facts (packaged foods and barcodes, no key needed) and, when USDA_API_KEY is set,
 * USDA FoodData Central (generic foods, the mixed-dish survey data behind burritos and curries, and branded foods). Results are normalised to values per 100 g
 * and cached in memory for ten minutes, so repeated searches never hit the providers twice. These
 * are public databases; the person's own food log never leaves their device.
 */

const TTL_MS = 10 * 60 * 1000;
const MAX_CACHE = 500;
const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const round1 = (n) => Math.round(n * 10) / 10;

export function fromOpenFoodFacts(p) {
  const n = p?.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? num(n.energy_100g) / 4.184 : undefined);
  if (!p?.product_name || kcal == null || !p.code) return null;
  const servingGrams = num(p.serving_quantity) || undefined;
  return {
    id: `off:${p.code}`,
    name: String(p.product_name).trim().slice(0, 120),
    brand: p.brands ? String(p.brands).split(',')[0].trim().slice(0, 60) : undefined,
    barcode: String(p.code),
    per100g: {
      kcal: Math.round(num(kcal)),
      protein: round1(num(n.proteins_100g)),
      carbs: round1(num(n.carbohydrates_100g)),
      fat: round1(num(n.fat_100g)),
      fiber: n.fiber_100g != null ? round1(num(n.fiber_100g)) : undefined
    },
    servingGrams,
    servingLabel: servingGrams ? String(p.serving_size || `${servingGrams} g`).slice(0, 40) : undefined,
    source: 'off'
  };
}

export function fromUsda(f) {
  const nutrients = f?.foodNutrients ?? [];
  const get = (...ids) => {
    const n = nutrients.find((x) => ids.includes(String(x.nutrientNumber ?? x.nutrientId)));
    return n ? num(n.value) : 0;
  };
  const kcal = get('208', '1008');
  if (!f?.description || !kcal) return null;
  const servingGrams = String(f.servingSizeUnit ?? '').toLowerCase() === 'g' ? num(f.servingSize) || undefined : undefined;
  return {
    id: `usda:${f.fdcId}`,
    name: String(f.description).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 120),
    brand: f.brandName || f.brandOwner ? String(f.brandName || f.brandOwner).slice(0, 60) : undefined,
    per100g: {
      kcal: Math.round(kcal),
      protein: round1(get('203', '1003')),
      carbs: round1(get('205', '1005')),
      fat: round1(get('204', '1004')),
      fiber: round1(get('291', '1079')) || undefined
    },
    servingGrams,
    servingLabel: servingGrams ? String(f.householdServingFullText || `${servingGrams} g`).slice(0, 40) : undefined,
    source: 'usda'
  };
}

/**
 * @param {{config: import('../config.js').Config, log: {warn:Function}, fetch?: typeof fetch, now?: () => number}} deps
 */
export function createFoods({ config, log, fetch: fetchImpl = globalThis.fetch, now = Date.now }) {
  const cache = new Map();
  async function cached(key, load) {
    const hit = cache.get(key);
    if (hit && now() - hit.at < TTL_MS) return hit.value;
    const value = await load();
    cache.set(key, { at: now(), value });
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return value;
  }

  async function getJson(url) {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'ModaWard-TrackWeight/1.0 (+https://modaward.com)' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return res.json();
  }

  async function searchOff(q) {
    const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '20', fields: OFF_FIELDS });
    const data = await getJson(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);
    return (data.products ?? []).map(fromOpenFoodFacts).filter(Boolean);
  }

  async function searchUsda(q) {
    const key = config.foods.usdaApiKey;
    if (!key) return [];
    const params = new URLSearchParams({ query: q, pageSize: '20', dataType: 'Foundation,SR Legacy,Survey (FNDDS),Branded', api_key: key });
    const data = await getJson(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`);
    return (data.foods ?? []).map(fromUsda).filter(Boolean);
  }

  return {
    usda: Boolean(config.foods.usdaApiKey),

    /** @returns {Promise<object[]|null>} foods, or null when every database was unreachable */
    async search(query) {
      const q = String(query ?? '').trim().toLowerCase().slice(0, 80);
      if (q.length < 2) return [];
      return cached(`q:${q}`, async () => {
        const settled = await Promise.allSettled([searchUsda(q), searchOff(q)]);
        for (const s of settled) if (s.status === 'rejected') log.warn('foods.search_failed', { message: String(s.reason?.message ?? s.reason).slice(0, 160) });
        if (settled.every((s) => s.status === 'rejected')) return null;
        return settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
      });
    },

    /** @returns {Promise<object|null|undefined>} the product, null if unknown, undefined if the database is unreachable */
    async barcode(code) {
      if (!/^\d{6,14}$/.test(String(code))) return null;
      try {
        return await cached(`bc:${code}`, async () => {
          const data = await getJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
          return data.status === 1 ? fromOpenFoodFacts({ ...data.product, code }) : null;
        });
      } catch (e) {
        log.warn('foods.barcode_failed', { message: String(e?.message ?? e).slice(0, 160) });
        return undefined;
      }
    }
  };
}
