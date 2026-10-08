/**
 * Translation core, shared by the browser and the server.
 *
 * Source text is English and doubles as the lookup key: `t('Take the style quiz')`. A locale file
 * (src/shared/locales/<code>.js) maps English strings to translations; anything missing falls back
 * to the English text, so a gap never breaks a screen. Placeholders use {name}.
 *
 *   t('Good morning, {name}', { name })
 *   tn(3, '{n} piece', '{n} pieces')        // plural forms are chosen with Intl.PluralRules
 *   L('Tops')                                // marks a label defined at module level (see scripts/i18n.mjs)
 */
export const LOCALES = Object.freeze({
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  tr: 'Türkçe'
});
export const DEFAULT_LOCALE = 'en';
/** Languages offered to people (picker and auto-detection). Add a code here once its locale file is complete. */
export const ENABLED_LOCALES = Object.freeze(['en']);
export const isLocale = (code) => typeof code === 'string' && Object.hasOwn(LOCALES, code);

/** First supported language from a list of BCP-47 tags ("es-MX" → "es"). */
export function pickLocale(tags = []) {
  for (const tag of tags) {
    const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
    if (isLocale(base) && ENABLED_LOCALES.includes(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** "de-DE,de;q=0.9,en;q=0.8" → ["de-DE", "de", "en"] ordered by preference. */
export function parseAcceptLanguage(header = '') {
  return String(header)
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1]);
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 1 };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole)) : text);

/** @param {string} locale @param {Record<string,string>} [dict] */
export function createTranslator(locale = DEFAULT_LOCALE, dict = {}) {
  const rules = new Intl.PluralRules(locale);
  const lookup = (key) => (typeof dict[key] === 'string' && dict[key] !== '' ? dict[key] : key);
  return {
    locale,
    t: (text, vars) => fill(lookup(text), vars),
    tn: (n, one, other, vars) => fill(lookup(rules.select(n) === 'one' ? one : other), { n, ...vars })
  };
}

/** Identity marker: tells the extractor that this literal is user-facing text to translate later. */
export const L = (text) => text;
