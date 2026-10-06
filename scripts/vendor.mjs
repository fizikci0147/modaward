// Bundles the browser dependencies into public/ so the deployed app needs no build step and
// loads nothing from third-party CDNs. Run `npm run vendor` after changing versions.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const nm = path.join(root, 'node_modules');
fs.mkdirSync(path.join(pub, 'vendor'), { recursive: true });
fs.mkdirSync(path.join(pub, 'fonts'), { recursive: true });

// one ESM bundle: Preact + hooks + htm (bound to h)
const entry = `
import { h, render, Fragment, createContext, createRef } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useContext, useReducer } from 'preact/hooks';
import htm from 'htm';
const html = htm.bind(h);
export { h, render, Fragment, createContext, createRef, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useContext, useReducer, html };
`;
await build({
  stdin: { contents: entry, resolveDir: root, loader: 'js' },
  bundle: true,
  format: 'esm',
  minify: true,
  target: ['es2020'],
  outfile: path.join(pub, 'vendor', 'ui.js'),
  legalComments: 'none'
});
for (const pkg of ['preact', 'htm']) {
  const lic = path.join(nm, pkg, 'LICENSE');
  if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(pub, 'vendor', `LICENSE-${pkg}.txt`));
}

// fonts (SIL Open Font License)
const fonts = [
  ['@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2', 'instrument-serif-400.woff2'],
  ['@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2', 'instrument-serif-400-italic.woff2'],
  ['@fontsource/instrument-serif/files/instrument-serif-latin-ext-400-normal.woff2', 'instrument-serif-ext-400.woff2'],
  ['@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'geist-latin.woff2'],
  ['@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2', 'geist-latin-ext.woff2']
];
for (const [src, dest] of fonts) fs.copyFileSync(path.join(nm, src), path.join(pub, 'fonts', dest));
for (const pkg of ['@fontsource/instrument-serif', '@fontsource-variable/geist']) {
  const lic = path.join(nm, pkg, 'LICENSE');
  if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(pub, 'fonts', `LICENSE-${pkg.split('/')[1]}.txt`));
}
const size = fs.statSync(path.join(pub, 'vendor', 'ui.js')).size;
console.log(`vendor/ui.js ${(size / 1024).toFixed(1)} KB; fonts copied`);
