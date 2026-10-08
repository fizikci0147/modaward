import { createTranslator, DEFAULT_LOCALE, ENABLED_LOCALES, isLocale, pickLocale, LOCALES } from '/shared/i18n.js';

export { LOCALES, ENABLED_LOCALES };
let current = createTranslator(DEFAULT_LOCALE, {});

/** Translate English source text. Missing translations fall back to English. */
export const t = (text, vars) => current.t(text, vars);
/** Plural-aware: tn(n, '{n} piece', '{n} pieces'). */
export const tn = (n, one, other, vars) => current.tn(n, one, other, vars);
export const getLocale = () => current.locale;
/** Rich text: tx(t('Agree to {terms}.'), { terms: html`<a>…</a>` }) swaps placeholders for nodes. */
export const tx = (text, nodes) => text.split(/(\{\w+\})/).map((part) => (/^\{\w+\}$/.test(part) && part.slice(1, -1) in nodes ? nodes[part.slice(1, -1)] : part));

const KEY = 'mw.locale';
const remembered = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** The language to start in: what the person chose before, else their browser's languages. */
export const detectLocale = () => (isLocale(remembered()) ? remembered() : pickLocale(navigator.languages?.length ? navigator.languages : [navigator.language]));

/** Load a language and make it current. Resolves to the language actually in use. */
export async function loadLocale(code) {
  const wanted = isLocale(code) ? code : DEFAULT_LOCALE;
  let dict = {};
  if (wanted !== DEFAULT_LOCALE) {
    try {
      dict = (await import(`/shared/locales/${wanted}.js`)).default;
    } catch {
      return current.locale; // offline or missing file: keep what we have
    }
  }
  current = createTranslator(wanted, dict);
  document.documentElement.lang = wanted;
  try {
    localStorage.setItem(KEY, wanted);
  } catch {
    /* private mode */
  }
  return wanted;
}
