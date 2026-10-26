import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { entryProblems, indexProblems, templatesFor, coverage, templateFile } from '../src/shared/template-index.js';
import { TYPE_IDS } from '../src/shared/taxonomy.js';
import { syntheticGarmentPng } from './e2e/photo.mjs';

const good = { id: 'classic-collar', type: 'shirt', label: 'Classic collar', widthCm: 58 };

describe('template list', () => {
  test('accepts a proper entry and explains each way an entry can be wrong', () => {
    assert.deepEqual(entryProblems(good), []);
    assert.deepEqual(entryProblems({ ...good, credit: { source: 'own photo', author: 'ModaWard', license: 'All rights reserved' } }), []);
    for (const [bad, word] of [
      [{ ...good, id: 'Classic Collar' }, 'id'],
      [{ ...good, type: 'spaceship' }, 'type'],
      [{ ...good, label: '' }, 'label'],
      [{ ...good, widthCm: 5 }, 'widthCm'],
      [{ ...good, widthCm: 'wide' }, 'widthCm'],
      [{ ...good, tags: [3] }, 'tags'],
      [{ ...good, credit: { source: 'https://example.org/a.jpg', author: 'A. Person' } }, 'license'],
      [{ ...good, credit: { source: 'http://example.org/a.jpg', author: 'A. Person', license: 'CC0' } }, 'https'],
      [{ ...good, credit: 'mine' }, 'credit'],
      [null, 'object']
    ]) assert.ok(entryProblems(bad).some((p) => p.includes(word)), `${JSON.stringify(bad)} -> ${entryProblems(bad)}`);
  });

  test('index checks catch duplicates and a missing list; coverage lists every garment type once', () => {
    assert.ok(indexProblems({}).length);
    assert.ok(indexProblems({ templates: [good, good] }).some((p) => p.includes('duplicate')));
    assert.deepEqual(indexProblems({ templates: [good] }), []);
    const c = coverage({ templates: [good, { ...good, id: 'slim' }, { id: 'crew', type: 'tee', label: 'Crew', widthCm: 52 }] });
    assert.equal(c.have.length + c.missing.length, TYPE_IDS.length);
    assert.deepEqual(c.have.map((t) => [t.id, t.count]), [['tee', 1], ['shirt', 2]]);
    assert.equal(templatesFor({ templates: [good] }, 'shirt').length, 1);
    assert.equal(templateFile(good), 'templates/shirt/classic-collar.png');
  });

  test('the shipped list is valid and every picture it names exists', () => {
    const dir = path.join(import.meta.dirname, '..', 'public', 'templates');
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    assert.deepEqual(indexProblems(index), []);
    for (const e of index.templates) {
      assert.ok(fs.existsSync(path.join(dir, e.type, `${e.id}.png`)), `${e.type}/${e.id}`);
      // every shipped photograph says where it came from and under which licence
      assert.ok(e.credit, `${e.type}/${e.id} has no credit`);
    }
  });
});

describe('adding a template from a photograph', () => {
  const chromiumThere = fs.existsSync('/opt/pw-browsers') || process.env.CHROMIUM_PATH;
  test('writes a transparent PNG and its list entry, and the checker accepts the result', { skip: !chromiumThere && 'no browser installed' }, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-'));
    try {
      const photo = path.join(tmp, 'tee.png');
      fs.writeFileSync(photo, syntheticGarmentPng({ width: 1600, height: 1600 }));
      const env = { ...process.env, TEMPLATES_DIR: path.join(tmp, 'out') };
      const root = path.join(import.meta.dirname, '..');
      const add = spawnSync(process.execPath, ['scripts/make-template.mjs', photo, '--type', 'tee', '--id', 'crew-neck', '--label', 'Crew neck', '--width', '52', '--source', 'own photo', '--author', 'Test', '--license', 'CC0'], { cwd: root, env, encoding: 'utf8' });
      assert.equal(add.status, 0, add.stderr);
      assert.ok(fs.existsSync(path.join(tmp, 'out', 'tee', 'crew-neck.png')));
      const idx = JSON.parse(fs.readFileSync(path.join(tmp, 'out', 'index.json'), 'utf8'));
      assert.deepEqual(idx.templates, [{ id: 'crew-neck', type: 'tee', label: 'Crew neck', widthCm: 52, credit: { source: 'own photo', author: 'Test', license: 'CC0' } }]);
      const check = spawnSync(process.execPath, ['scripts/check-templates.mjs'], { cwd: root, env, encoding: 'utf8' });
      assert.equal(check.status, 0, check.stdout + check.stderr);
      assert.match(check.stdout, /✓ tee\s+1 template/);
      // a wrong type is refused before anything is written
      const bad = spawnSync(process.execPath, ['scripts/make-template.mjs', photo, '--type', 'spaceship', '--id', 'x1'], { cwd: root, env, encoding: 'utf8' });
      assert.notEqual(bad.status, 0);
      assert.match(bad.stderr, /not a garment type/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
