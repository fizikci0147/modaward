/**
 * Turns a forecast day into the context the engine reasons about, plus the plain-language
 * "heads-up" tips shown above outfits (umbrella, sunscreen, big temperature swings…).
 *
 * All temperatures are °C internally; `units` only affects the wording of tips.
 */
import { describeCode, cToF, kphToMph } from '../shared/weather-codes.js';
import { createTranslator } from '../shared/i18n.js';

const ENGLISH = createTranslator('en');

const DEFAULT_WINDOW = [8, 21];

/** Hours with no data are synthesised from the daily extremes (cosine curve peaking at 15:00). */
function synthesiseHours(day, [from, to]) {
  const hours = [];
  const meanT = (day.tMaxC + day.tMinC) / 2;
  const ampT = (day.tMaxC - day.tMinC) / 2;
  const feelsMax = day.feelsMaxC ?? day.tMaxC;
  const feelsMin = day.feelsMinC ?? day.tMinC;
  const meanF = (feelsMax + feelsMin) / 2;
  const ampF = (feelsMax - feelsMin) / 2;
  for (let hour = from; hour <= to; hour++) {
    const k = Math.cos(((hour - 15) / 24) * 2 * Math.PI);
    hours.push({
      hour,
      tempC: meanT + ampT * k,
      feelsC: meanF + ampF * k,
      precipProb: day.precipProb ?? 0,
      precipMm: (day.precipMm ?? 0) / (to - from + 1),
      code: day.code ?? 0,
      windKph: day.windKphMax ?? 0,
      uv: hour >= 11 && hour <= 16 ? day.uvMax ?? 0 : (day.uvMax ?? 0) * 0.4
    });
  }
  return hours;
}

/**
 * @param {object} day  normalised forecast day (see services/weather.js)
 * @param {{window?:[number,number], nowHour?:number|null, units?:'metric'|'imperial', t?:Function, locale?:string}} [opts]
 *   `t` and `locale` choose the language of the tips and explanations (English by default)
 */
export function buildContext(day, opts = {}) {
  const window = opts.window || DEFAULT_WINDOW;
  const units = opts.units || 'metric';

  let source = (day.hours || []).filter((h) => h.hour >= window[0] && h.hour <= window[1]);
  if (!source.length) source = synthesiseHours(day, window);

  let selected = source;
  if (opts.nowHour != null) {
    const remaining = source.filter((h) => h.hour >= opts.nowHour);
    // late in the day, plan for what is left but never fewer than three hours
    selected = remaining.length >= 3 ? remaining : source.slice(-3);
  }

  const hours = selected.map((h) => ({
    hour: h.hour,
    feels: h.feelsC ?? h.tempC,
    temp: h.tempC,
    rainProb: h.precipProb ?? 0,
    precipMm: h.precipMm ?? 0,
    wind: h.windKph ?? 0,
    uv: h.uv ?? 0,
    code: h.code ?? 0
  }));

  const feels = hours.map((h) => h.feels);
  const totalMm = hours.reduce((s, h) => s + h.precipMm, 0);
  const maxProb = Math.max(0, ...hours.map((h) => h.rainProb));
  const snow = hours.some((h) => describeCode(h.code).snow && (h.precipMm > 0 || h.rainProb >= 40));
  const storm = hours.some((h) => h.code >= 95);

  let rain = 'none';
  if (storm || totalMm >= 4 || (maxProb >= 70 && totalMm >= 1.5)) rain = 'heavy';
  else if (maxProb >= 40 || totalMm >= 0.5) rain = 'light';
  if (snow && rain === 'none') rain = 'light';

  const wetHours = hours.filter((h) => h.rainProb >= 50 || h.precipMm >= 0.3).map((h) => h.hour);

  return {
    t: opts.t ?? ENGLISH.t,
    locale: opts.locale ?? 'en',
    date: day.date,
    units,
    hours,
    minFeels: Math.min(...feels),
    maxFeels: Math.max(...feels),
    avgFeels: feels.reduce((s, v) => s + v, 0) / feels.length,
    swing: Math.max(...feels) - Math.min(...feels),
    rain,
    wetHours,
    maxRainProb: maxProb,
    snow,
    storm,
    maxUv: Math.max(0, ...hours.map((h) => h.uv)),
    maxWind: Math.max(0, ...hours.map((h) => h.wind)),
    condition: describeCode(day.code ?? 0)
  };
}

/** 15 → "3pm" in English, "15:00" elsewhere (24-hour clocks). */
export const fmtHour = (h, locale = 'en') => (locale === 'en' ? `${h % 12 === 0 ? 12 : h % 12}${h < 12 || h === 24 ? 'am' : 'pm'}` : `${h % 24}:00`);

const fmtTemp = (c, units) => (units === 'imperial' ? `${Math.round(cToF(c))}°F` : `${Math.round(c)}°C`);

/** @returns {{kind:string, icon:string, text:string}[]} */
export function dayTips(ctx) {
  const { t, locale } = ctx;
  const tips = [];
  const { units } = ctx;
  const hourText = (h) => fmtHour(h, locale);

  if (ctx.snow) {
    tips.push({ kind: 'snow', icon: 'snow', text: t('Snow expected. Grip, warm socks and a waterproof outer layer matter today.') });
  } else if (ctx.rain !== 'none') {
    const first = ctx.wetHours[0];
    const chance = Math.round(ctx.maxRainProb);
    const heavy = ctx.rain === 'heavy';
    const text =
      first != null
        ? heavy
          ? t('Heavy rain likely from around {time} ({chance}% chance). Take an umbrella.', { time: hourText(first), chance })
          : t('Showers likely from around {time} ({chance}% chance). Take an umbrella.', { time: hourText(first), chance })
        : heavy
          ? t('Heavy rain likely ({chance}% chance). Take an umbrella.', { chance })
          : t('Showers likely ({chance}% chance). Take an umbrella.', { chance });
    tips.push({ kind: 'rain', icon: 'umbrella', text });
  }

  if (ctx.swing >= 8) {
    const cold = ctx.hours.reduce((a, b) => (b.feels < a.feels ? b : a));
    const warm = ctx.hours.reduce((a, b) => (b.feels > a.feels ? b : a));
    tips.push({
      kind: 'swing',
      icon: 'layers',
      text: t('A {n}° swing: {cold} at {coldTime}, {warm} at {warmTime}. Dress in layers.', {
        n: Math.round(units === 'imperial' ? ctx.swing * 1.8 : ctx.swing),
        cold: fmtTemp(cold.feels, units),
        coldTime: hourText(cold.hour),
        warm: fmtTemp(warm.feels, units),
        warmTime: hourText(warm.hour)
      })
    });
  }

  if (ctx.maxUv >= 6) {
    tips.push({ kind: 'uv', icon: 'sun', text: t('UV index up to {n}. Sunglasses and sunscreen.', { n: Math.round(ctx.maxUv) }) });
  }

  if (ctx.maxWind >= 40) {
    const speed = units === 'imperial' ? `${Math.round(kphToMph(ctx.maxWind))} mph` : `${Math.round(ctx.maxWind)} km/h`;
    tips.push({ kind: 'wind', icon: 'wind', text: t('Gusts up to {speed}. A windproof layer will help.', { speed }) });
  }

  if (ctx.minFeels <= -5) {
    tips.push({ kind: 'cold', icon: 'snow', text: t('Bitter cold. Cover hands, ears and neck.') });
  } else if (ctx.maxFeels >= 32) {
    tips.push({ kind: 'heat', icon: 'sun', text: t('Very hot. Choose breathable, light fabrics and stay hydrated.') });
  }

  return tips;
}
