#!/usr/bin/env node
/**
 * Translation tooling.
 *
 *   node scripts/i18n.mjs extract           print every translatable English string (one per line, JSON)
 *   node scripts/i18n.mjs check             verify each enabled language covers every string (used by `npm run check`)
 *   node scripts/i18n.mjs scaffold <code>   write src/shared/locales/<code>.js with every key and an empty value
 *
 * English text is the key. Strings are found where code calls t('…'), tn(n, '…', '…'), L('…'),
 * req.t('…'), or raises a user-facing error (badRequest('…'), new HttpError(…, '…'), …).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['public/js', 'src'];
// operator-only and legal screens stay in English
const SKIP = [/src\/shop\/feed\.js$/, /public\/js\/views\/admin\.js$/, /public\/js\/views\/legal\.js$/, /src\/shared\/locales\//, /src\/db\/migrations\//];

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });

const STR = String.raw`(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|\`([^\`$]*)\`)`;
const unescape = (s) => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
const pick = (m, offset) => unescape(m[offset] ?? m[offset + 1] ?? m[offset + 2] ?? '');

export function extract() {
  const keys = new Map(); // text -> first file
  const problems = [];
  let strong = true;
  const add = (text, file) => {
    if (!text || keys.has(text)) return;
    // the broad `message:`/`reason:`/`template:` patterns also match ids and codes: keep only prose
    if (!strong && !(/\s/.test(text) || /^[A-Z]/.test(text))) return;
    keys.set(text, file);
  };
  const single = [
    new RegExp(String.raw`(?<![\w$.])(?:t|L|tr)\(\s*${STR}`, 'g'),
    new RegExp(String.raw`\breq\.t\(\s*${STR}`, 'g'),
    new RegExp(String.raw`\b(?:badRequest|forbidden|notFound|conflict|unauthorized|tooMany|paymentRequired|unavailable)\(\s*${STR}`, 'g'),
    new RegExp(String.raw`new HttpError\(\s*\d+\s*,\s*'[\w]+'\s*,\s*${STR}`, 'g'),
    new RegExp(String.raw`\b(?:template|reason|message|patternMessage):\s*${STR}`, 'g')
  ];
  // validation reasons live in one file as bare literals ("is required", "must be at least {min} characters")
  const reasons = /'((?:must|is|has)\s[^'\n]*)'/g;
  const plural = new RegExp(String.raw`(?<![\w$.])(?:tn|req\.tn)\(\s*[^,()]+(?:\([^()]*\))?[^,()]*,\s*${STR}\s*,\s*${STR}`, 'g');
  // dynamic text can't be translated: flag t(`…${x}…`)
  const dynamic = /(?<![\w$.])t\(\s*`[^`]*\$\{/g;

  for (const base of SCAN) {
    for (const file of walk(path.join(root, base))) {
      const rel = path.relative(root, file);
      if (SKIP.some((re) => re.test(rel))) continue;
      const src = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      single.forEach((re, i) => {
        strong = i < 4;
        for (const m of src.matchAll(re)) add(pick(m, 1), rel);
      });
      strong = true;
      if (rel.endsWith('util/validate.js')) for (const m of src.matchAll(reasons)) add(m[1], rel);
      for (const m of src.matchAll(plural)) {
        add(pick(m, 1), rel);
        add(pick(m, 4), rel);
      }
      for (const m of src.matchAll(dynamic)) problems.push(`${rel}: t(\`…\${…}\`) cannot be translated; use {placeholders}`);
    }
  }
  return { keys, problems };
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

async function loadLocale(code) {
  const file = path.join(root, 'src/shared/locales', `${code}.js`);
  if (!fs.existsSync(file)) return null;
  return (await import(pathToFileURL(file).href)).default;
}

async function check() {
  const { LOCALES, ENABLED_LOCALES } = await import(pathToFileURL(path.join(root, 'src/shared/i18n.js')).href);
  const { keys, problems } = extract();
  let failed = problems.length > 0;
  for (const p of problems) console.error(`✖ ${p}`);
  for (const code of ENABLED_LOCALES.filter((c) => c !== 'en')) {
    const dict = await loadLocale(code);
    if (!dict) {
      console.error(`✖ ${code}: src/shared/locales/${code}.js is missing`);
      failed = true;
      continue;
    }
    const missing = [];
    const broken = [];
    for (const key of keys.keys()) {
      const value = dict[key];
      if (typeof value !== 'string' || value.trim() === '') missing.push(key);
      else if (placeholders(value) !== placeholders(key)) broken.push(`${key}  →  ${value}`);
    }
    if (missing.length) {
      failed = true;
      console.error(`✖ ${LOCALES[code]} (${code}) is missing ${missing.length} of ${keys.size} strings, e.g.:\n   ${missing.slice(0, 5).join('\n   ')}`);
    }
    if (broken.length) {
      failed = true;
      console.error(`✖ ${LOCALES[code]} (${code}) has placeholders that do not match:\n   ${broken.slice(0, 5).join('\n   ')}`);
    }
    const stale = Object.keys(dict).filter((k) => !keys.has(k));
    if (stale.length) console.warn(`! ${code}: ${stale.length} unused entries (safe to delete), e.g. ${stale.slice(0, 3).join(' | ')}`);
  }
  if (failed) process.exit(1);
  console.log(`✔ translations: ${keys.size} strings × ${ENABLED_LOCALES.length - 1} languages complete`);
}

const [cmd, arg] = process.argv.slice(2);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (cmd === 'extract') {
    const { keys, problems } = extract();
    problems.forEach((p) => console.error(p));
    console.log(JSON.stringify([...keys.keys()], null, 1));
  } else if (cmd === 'check') await check();
  else if (cmd === 'scaffold' && arg) {
    const { keys } = extract();
    const old = (await loadLocale(arg)) ?? {};
    const lines = [...keys.keys()].map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(old[k] ?? '')},`);
    fs.writeFileSync(path.join(root, 'src/shared/locales', `${arg}.js`), `// Generated by scripts/i18n.mjs. English text is the key.\nexport default {\n${lines.join('\n')}\n};\n`);
    console.log(`wrote ${arg}.js with ${keys.size} keys`);
  } else console.log('usage: node scripts/i18n.mjs extract|check|scaffold <code>');
}
