/** Shared test data: a realistic closet and a handful of weather days. */

let n = 0;
const g = (type, name, color, extra = {}) => ({
  id: `g${++n}`,
  type,
  name,
  color,
  pattern: 'solid',
  ...extra
});

export function closet() {
  n = 0;
  return [
    g('tee', 'White tee', '#f7f6f2'),
    g('tee', 'Black tee', '#1c1c1e'),
    g('longsleeve', 'Grey long-sleeve', '#8e9096'),
    g('shirt', 'Light blue oxford', '#8fa9c8'),
    g('shirt', 'White poplin shirt', '#f7f6f2'),
    g('polo', 'Navy polo', '#1f2f54'),
    g('sweater', 'Cream knit sweater', '#efe6d2'),
    g('sweater', 'Burgundy sweater', '#6d1f35'),
    g('cardigan', 'Camel cardigan', '#b58750'),
    g('hoodie', 'Grey hoodie', '#8e9096'),
    g('jeans', 'Dark jeans', '#2b3a55'),
    g('jeans', 'Light jeans', '#8fa9c8'),
    g('chinos', 'Khaki chinos', '#a39a6a'),
    g('trousers', 'Charcoal trousers', '#3d3f44'),
    g('shorts', 'Beige shorts', '#cdb89a'),
    g('joggers', 'Black joggers', '#1c1c1e'),
    g('skirt', 'Black midi skirt', '#1c1c1e'),
    g('sundress', 'Floral sundress', '#e0709a', { pattern: 'floral' }),
    g('blazer', 'Navy blazer', '#1f2f54'),
    g('raincoat', 'Yellow rain jacket', '#f0cf4a'),
    g('trench', 'Beige trench', '#cdb89a'),
    g('wool-coat', 'Camel wool coat', '#b58750'),
    g('parka', 'Black parka', '#1c1c1e'),
    g('denimjacket', 'Denim jacket', '#4b6a93'),
    g('sneakers', 'White sneakers', '#f7f6f2'),
    g('loafers', 'Brown loafers', '#6b4a32'),
    g('dressshoes', 'Black dress shoes', '#1c1c1e'),
    g('waterproofboots', 'Waterproof boots', '#6b4a32'),
    g('sandals', 'Tan sandals', '#b58750'),
    g('scarf', 'Grey scarf', '#8e9096'),
    g('beanie', 'Black beanie', '#1c1c1e'),
    g('sunglasses', 'Sunglasses', '#1c1c1e'),
    g('umbrella', 'Black umbrella', '#1c1c1e')
  ];
}

/** Build a forecast day with a simple diurnal curve. */
export function day({ date = '2026-10-07', min, max, rainProb = 0, rainMm = 0, code = 0, uv = 3, wind = 10 }) {
  const hours = [];
  for (let hour = 0; hour < 24; hour++) {
    const k = Math.cos(((hour - 15) / 24) * 2 * Math.PI);
    const t = (max + min) / 2 + ((max - min) / 2) * k;
    hours.push({
      hour,
      tempC: t,
      feelsC: t,
      precipProb: rainProb,
      precipMm: rainMm / 24,
      code,
      windKph: wind,
      uv: hour >= 10 && hour <= 16 ? uv : 0
    });
  }
  return {
    date,
    code,
    tMaxC: max,
    tMinC: min,
    feelsMaxC: max,
    feelsMinC: min,
    precipMm: rainMm,
    precipProb: rainProb,
    windKphMax: wind,
    uvMax: uv,
    hours
  };
}

export const COLD_RAIN = day({ min: 3, max: 8, rainProb: 85, rainMm: 12, code: 63 });
export const HOT_SUN = day({ min: 22, max: 33, uv: 9, code: 0 });
export const MILD = day({ min: 14, max: 22, code: 2 });
export const FREEZING = day({ min: -8, max: -2, code: 71, rainProb: 70, rainMm: 3 });
