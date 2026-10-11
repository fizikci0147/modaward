#!/usr/bin/env node
/**
 * Writes www/index.html and www/offline.html for the server the app will load (MODAWARD_URL,
 * https://modaward.com by default). The app itself is the website, so www/ holds only these two small
 * pages: a redirect, and the "you're offline" screen with a Retry button.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (process.env.MODAWARD_URL || 'https://modaward.com').replace(/\/+$/, '');
try {
  new URL(url);
} catch {
  console.error(`MODAWARD_URL is not a valid address: ${url}`);
  process.exit(1);
}
fs.mkdirSync(path.join(root, 'www'), { recursive: true });
for (const name of ['index.html', 'offline.html']) {
  const html = fs.readFileSync(path.join(root, 'templates', name), 'utf8').replaceAll('__SERVER_URL__', url);
  fs.writeFileSync(path.join(root, 'www', name), html);
}
console.log(`www/ ready for ${url}`);
