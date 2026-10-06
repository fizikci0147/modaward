import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// A path *under a file* can never be created, whatever user runs the test.
const BAD_DIR = path.join(root, 'package.json', 'data');
const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); }); });

async function boot(entry, env) {
  const port = await freePort();
  const child = spawn(process.execPath, [entry], { cwd: root, env: { ...process.env, NODE_NO_WARNINGS: '1', PORT: String(port), HOST: '127.0.0.1', WEATHER_PROVIDER: 'mock', ...env }, stdio: 'ignore' });
  let res;
  for (let i = 0; i < 60 && !res; i++) {
    await new Promise((r) => setTimeout(r, 150));
    res = await fetch(`http://127.0.0.1:${port}/health`).catch(() => null);
  }
  return { child, res, text: res ? await res.text() : '', port };
}

describe('startup', () => {
  for (const entry of ['server.js', 'app.js', 'index.js']) {
    test(`${entry} boots the app (hosts start different default files)`, async () => {
      const data = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-boot-'));
      const { child, res, text } = await boot(entry, { DATA_DIR: data });
      try {
        assert.equal(res?.status, 200, text);
        assert.match(text, /"ok":true/);
      } finally {
        child.kill();
        fs.rmSync(data, { recursive: true, force: true });
      }
    });
  }

  test('a startup failure serves a readable 503 instead of dying silently, and logs the reason', async () => {
    const log = path.join(root, 'startup-error.log');
    fs.rmSync(log, { force: true });
    const hidden = await boot('server.js', { DATA_DIR: BAD_DIR });
    try {
      assert.equal(hidden.res?.status, 503);
      assert.match(hidden.text, /failed to start/i);
      assert.ok(!hidden.text.includes('package.json'), 'reason must be hidden unless SHOW_STARTUP_ERRORS=1');
      assert.match(fs.readFileSync(log, 'utf8'), /No writable data directory/);
    } finally {
      hidden.child.kill();
    }
    const shown = await boot('server.js', { DATA_DIR: BAD_DIR, SHOW_STARTUP_ERRORS: '1' });
    try {
      assert.equal(shown.res?.status, 503);
      assert.match(shown.text, /No writable data directory/);
    } finally {
      shown.child.kill();
      fs.rmSync(log, { force: true });
    }
  });
});
