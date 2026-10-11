#!/usr/bin/env node
/**
 * Gives the iOS and Android projects the same version as the website (the root package.json), so
 * "ModaWard 5.14.0" means the same thing everywhere. The build number only ever goes up:
 * major*10000 + minor*100 + patch (5.14.0 -> 51400), which both stores require.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, '..', 'package.json'), 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map((n) => parseInt(n, 10));
if ([major, minor, patch].some(Number.isNaN)) throw new Error(`Cannot read the version from package.json: ${pkg.version}`);
const code = major * 10000 + minor * 100 + patch;

const edit = (file, fn) => {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return console.log(`(skipped ${file}: not created yet; run "npx cap add ${file.split('/')[0]}")`);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) fs.writeFileSync(p, after);
  console.log(`${file}: ${pkg.version} (${code})`);
};

edit('android/app/build.gradle', (s) => s.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`));
edit('ios/App/App.xcodeproj/project.pbxproj', (s) => s.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${pkg.version};`).replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${code};`));
