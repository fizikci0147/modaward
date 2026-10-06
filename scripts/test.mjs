// Cross-version test runner: `node --test <dir>` and glob support differ between Node 20 and 22+,
// so list the files ourselves. Usage: node scripts/test.mjs [filter]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv[2] || '';
const files = fs
  .readdirSync(path.join(root, 'test'))
  .filter((f) => f.endsWith('.test.js') && f.includes(filter))
  .map((f) => path.join('test', f));

const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
process.exit(r.status ?? 1);
