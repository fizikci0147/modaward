/**
 * Server-side translation: loads the locale files once at startup and hands out translators.
 * Text produced by the server (outfit reasons, tips, errors, emails) is translated into the
 * language the request asks for (X-Locale header, then Accept-Language, then English).
 */
import { createTranslator, DEFAULT_LOCALE, ENABLED_LOCALES, isLocale, parseAcceptLanguage, pickLocale } from '../shared/i18n.js';

const translators = new Map([[DEFAULT_LOCALE, createTranslator(DEFAULT_LOCALE, {})]]);

/** Load every enabled locale file. A missing or broken file only costs that language. */
export async function loadLocales(log) {
  for (const code of ENABLED_LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    try {
      const dict = (await import(`../shared/locales/${code}.js`)).default;
      translators.set(code, createTranslator(code, dict));
    } catch (err) {
      log?.warn('i18n.load_failed', { locale: code, message: err.message });
    }
  }
}

/** Translator for a language code; unknown codes get English. */
export const translatorFor = (code) => translators.get(code) ?? translators.get(DEFAULT_LOCALE);

/** X-Locale wins (the app sends the language the person chose), then the browser's Accept-Language. */
export function localeFromRequest(req) {
  const explicit = req.get?.('x-locale');
  if (isLocale(explicit) && translators.has(explicit)) return explicit;
  const picked = pickLocale(parseAcceptLanguage(req.get?.('accept-language') || ''));
  return translators.has(picked) ? picked : DEFAULT_LOCALE;
}

/** Express middleware: req.locale, req.t, req.tn. */
export function localeMiddleware(req, _res, next) {
  req.locale = localeFromRequest(req);
  const tr = translatorFor(req.locale);
  req.t = tr.t;
  req.tn = tr.tn;
  next();
}
