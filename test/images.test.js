import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeDataUrl, createImageStore, sniffImage } from '../src/services/images.js';

// 1x1 transparent PNG
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
// minimal valid 1x1 JPEG
const JPG_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

describe('image validation', () => {
  test('accepts PNG and JPEG and reads true dimensions', () => {
    assert.deepEqual(sniffImage(Buffer.from(PNG_B64, 'base64')).width, 1);
    const j = decodeDataUrl('data:image/jpeg;base64,' + JPG_B64);
    assert.equal(j.info.ext, 'jpg');
    assert.equal(j.info.width, 1);
  });

  test('rejects a mismatched declared type (HTML with a PNG label)', () => {
    const evil = 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
    assert.throws(() => decodeDataUrl(evil), /not a valid image/);
  });

  test('rejects non-image schemes and malformed base64', () => {
    assert.throws(() => decodeDataUrl('data:text/html;base64,PGI+'), /Choose a JPEG/);
    assert.throws(() => decodeDataUrl('data:image/png;base64,@@@'), /Choose a JPEG/);
    assert.throws(() => decodeDataUrl(42), /too large|Choose/);
  });

  test('rejects oversized dimensions', () => {
    const b = Buffer.from(PNG_B64, 'base64');
    b.writeUInt32BE(9000, 16);
    assert.throws(() => decodeDataUrl('data:image/png;base64,' + b.toString('base64')), /at most/);
  });
});

describe('image store', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-img-'));
  const store = createImageStore(dir);

  test('saves under random names and removes them', () => {
    const a = store.save('data:image/png;base64,' + PNG_B64);
    const b = store.save('data:image/png;base64,' + PNG_B64);
    assert.notEqual(a.name, b.name);
    assert.match(a.name, /^g_[a-f0-9]{32}\.png$/);
    assert.ok(fs.existsSync(store.pathFor(a.name)));
    store.remove(a.name);
    assert.ok(!fs.existsSync(path.join(store.dir, a.name)));
    store.remove(a.name); // idempotent
  });

  test('refuses path traversal and foreign names', () => {
    for (const bad of ['../../etc/passwd', 'g_zz.png', '/etc/passwd', 'g_' + 'a'.repeat(32) + '.svg', null, undefined]) {
      assert.equal(store.pathFor(bad), null);
    }
  });
});
