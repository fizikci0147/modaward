/** WMO weather interpretation codes (as returned by Open-Meteo) → app conditions. */

/** @typedef {'clear'|'partly'|'cloudy'|'fog'|'drizzle'|'rain'|'snow'|'storm'} Condition */

/** @param {number} code @returns {{condition: Condition, label: string, wet: boolean, snow: boolean}} */
export function describeCode(code) {
  if (code === 0) return { condition: 'clear', label: 'Clear', wet: false, snow: false };
  if (code === 1) return { condition: 'clear', label: 'Mostly clear', wet: false, snow: false };
  if (code === 2) return { condition: 'partly', label: 'Partly cloudy', wet: false, snow: false };
  if (code === 3) return { condition: 'cloudy', label: 'Overcast', wet: false, snow: false };
  if (code === 45 || code === 48) return { condition: 'fog', label: 'Fog', wet: false, snow: false };
  if (code >= 51 && code <= 57) return { condition: 'drizzle', label: 'Drizzle', wet: true, snow: false };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { condition: 'rain', label: code >= 80 ? 'Rain showers' : 'Rain', wet: true, snow: false };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { condition: 'snow', label: 'Snow', wet: true, snow: true };
  }
  if (code >= 95) return { condition: 'storm', label: 'Thunderstorm', wet: true, snow: false };
  return { condition: 'cloudy', label: 'Cloudy', wet: false, snow: false };
}

export const cToF = (c) => (c * 9) / 5 + 32;
export const kphToMph = (k) => k * 0.621371;
export const mmToIn = (mm) => mm / 25.4;
