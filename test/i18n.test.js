import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser, NYC } from './helpers.js';
import { createTranslator, pickLocale, parseAcceptLanguage, isLocale, LOCALES, ENABLED_LOCALES } from '../src/shared/i18n.js';
import { loadLocales, translatorFor } from '../src/i18n/index.js';

await loadLocales();

describe('translation core', () => {
  test('placeholders, fallback to English and plural forms', () => {
    const { t, tn } = createTranslator('es', { Hello: 'Hola, {name}', '{n} piece': '{n} prenda', '{n} pieces': '{n} prendas' });
    assert.equal(t('Hello', { name: 'Ada' }), 'Hola, Ada');
    assert.equal(t('Not translated yet {x}', { x: 1 }), 'Not translated yet 1', 'missing keys fall back to the English text');
    assert.equal(tn(1, '{n} piece', '{n} pieces'), '1 prenda');
    assert.equal(tn(3, '{n} piece', '{n} pieces'), '3 prendas');
    assert.equal(t('Hello'), 'Hola, {name}', 'unfilled placeholders are left visible rather than hidden');
  });

  test('language detection from Accept-Language and browser tags', () => {
    assert.deepEqual(parseAcceptLanguage('de-DE,de;q=0.9,en;q=0.8'), ['de-DE', 'de', 'en']);
    assert.deepEqual(parseAcceptLanguage('en;q=0.4, fr;q=0.9'), ['fr', 'en']);
    assert.equal(pickLocale(['pt-BR', 'en']), 'pt');
    assert.equal(pickLocale(['ja-JP', 'tr-TR']), 'tr', 'skips unsupported languages');
    assert.equal(pickLocale(['ja']), 'en');
    assert.equal(pickLocale([]), 'en');
    assert.ok(isLocale('it') && !isLocale('xx') && !isLocale('__proto__'));
  });

  test('every offered language has a name and a loaded dictionary', () => {
    for (const code of ENABLED_LOCALES) {
      assert.ok(LOCALES[code]);
      const tr = translatorFor(code);
      assert.equal(tr.locale, code);
      if (code !== 'en') assert.notEqual(tr.t('Sign in'), 'Sign in', `${code} translates the basics`);
    }
  });
});

describe('server speaks the requested language', () => {
  let t;
  before(async () => {
    t = await startTestServer();
  });
  after(() => t.close());
  const as = (c, locale) => (url, body) => c.raw(body === undefined ? 'GET' : 'POST', url, body, { 'x-locale': locale });

  test('error messages, validation and Accept-Language', async () => {
    const c = t.client();
    const bad = await c.raw('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'whatever password' }, { 'x-locale': 'de' });
    assert.equal(bad.status, 401);
    assert.equal(bad.json.error.message, 'Falsche E-Mail oder falsches Passwort.');
    const accept = await c.raw('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'whatever password' }, { 'accept-language': 'it-IT,it;q=0.9,en;q=0.5' });
    assert.equal(accept.json.error.message, 'E-mail o password errate.');
    const unknown = await c.raw('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'whatever password' }, { 'x-locale': 'xx' });
    assert.equal(unknown.json.error.message, 'Incorrect email or password.', 'unsupported languages fall back to English');
    const invalid = await c.raw('POST', '/api/auth/register', { email: 'not-an-email', password: 'correct horse battery', acceptTerms: true }, { 'x-locale': 'fr' });
    assert.equal(invalid.status, 400);
    assert.match(invalid.json.error.message, /doit être une adresse e-mail valide/);
  });

  test('outfit reasons and tips, starter wardrobe and default names are localised', async () => {
    const c = t.client();
    await registerUser(c);
    await c.patch('/api/profile', { location: NYC });
    const starter = await c.raw('POST', '/api/garments/starter', { department: 'unisex' }, { 'x-locale': 'fr' });
    assert.ok(starter.json.garments.some((g) => g.name === 'T-shirt blanc'), 'starter pieces are named in French');
    const made = await c.raw('POST', '/api/garments', { type: 'tee', color: '#1f2f54' }, { 'x-locale': 'es' });
    assert.equal(made.json.garment.name, 'Camiseta azul marino');

    const en = (await c.post('/api/outfits/recommend', { occasion: 'casual', count: 3 })).json;
    const es = (await c.raw('POST', '/api/outfits/recommend', { occasion: 'casual', count: 3 }, { 'x-locale': 'es' })).json;
    const reasons = (r) => r.outfits.flatMap((o) => o.reasons.map((x) => x.text));
    assert.ok(reasons(en).some((x) => /^(Right for|Built for|The )/.test(x)), 'English reasons by default');
    assert.ok(reasons(es).length > 0);
    assert.ok(!reasons(es).some((x) => /^(Right for|Built for)/.test(x)), 'Spanish reasons are not English');
    assert.ok(reasons(es).some((x) => /Adecuado|Pensado|te mantiene|paleta|estrenado/.test(x)));
  });

  test('shop looks and closet gaps are localised and cached per language', async () => {
    const c = t.client();
    await registerUser(c);
    await c.patch('/api/profile', { location: NYC, department: 'women', lifestyle: { occasions: ['work'] } });
    const de = (await c.raw('POST', '/api/shop/looks', { kind: 'new', seed: '1' }, { 'x-locale': 'de' })).json;
    const en = (await c.post('/api/shop/looks', { kind: 'new', seed: '1' })).json;
    assert.ok(de.looks.length > 0);
    assert.match(de.looks[0].title, /für die Arbeit|fürs|für/);
    assert.match(en.looks[0].title, / for work$/);
    assert.notEqual(de.looks[0].reasons.join(' '), en.looks[0].reasons.join(' '));
    const gaps = (await c.raw('POST', '/api/shop/gaps', {}, { 'x-locale': 'es' })).json.gaps;
    assert.ok(gaps.length > 0);
    assert.ok(gaps.every((g) => !/^(A|An) [a-z]/.test(g.title) || /^(Un|Una)/.test(g.title)), 'gap titles are in Spanish');
  });

  test('the chosen language is saved on the account and validated', async () => {
    const c = t.client();
    await registerUser(c);
    assert.equal((await c.patch('/api/profile', { locale: 'tr' })).json.profile.locale, 'tr');
    assert.equal((await c.get('/api/auth/me')).json.profile.locale, 'tr');
    assert.equal((await c.patch('/api/profile', { locale: 'xx' })).status, 400);
    assert.equal((await c.patch('/api/profile', { locale: null })).json.profile.locale, null);
  });

  test('the password-reset email is sent in the requester’s language', async () => {
    const sent = [];
    const t2 = await startTestServer({ overrides: { mailer: { configured: true, send: async (m) => sent.push(m) } }, env: { APP_URL: 'https://app.example.com' } });
    try {
      const c = t2.client();
      const { email } = await registerUser(c, { name: 'Ada' });
      await c.raw('POST', '/api/auth/forgot', { email }, { 'x-locale': 'pt' });
      assert.equal(sent.length, 1);
      assert.match(sent[0].subject, /Redefina sua senha/);
      assert.match(sent[0].text, /Olá, Ada,/);
      assert.match(sent[0].html, /<a href="https:\/\/app\.example\.com\/reset\?token=/);
    } finally {
      await t2.close();
    }
  });
});
