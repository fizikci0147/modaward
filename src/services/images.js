/**
 * Garment/avatar photo storage.
 *
 * The browser downsizes photos to JPEG before upload; the server still treats the bytes as
 * hostile: it checks magic numbers, parses real dimensions, caps size, and stores under random
 * names so a URL can never be guessed or collide.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { badRequest } from '../util/errors.js';

export const MAX_BYTES = 3 * 1024 * 1024;
export const MAX_DIMENSION = 5000;
const NAME_RE = /^g_[a-f0-9]{32}\.(jpg|png|webp)$/;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngInfo(b) {
  if (b.length < 24 || !b.subarray(0, 8).equals(PNG) || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { ext: 'png', mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpegInfo(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 9 < b.length) {
    if (b[pos] !== 0xff) {
      pos += 1;
      continue;
    }
    while (b[pos] === 0xff) pos += 1;
    const marker = b[pos++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    const len = b.readUInt16BE(pos);
    if (len < 2 || pos + len > b.length) break;
    // SOF0–SOF15 except DHT (c4), JPG (c8), DAC (cc)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && len >= 7) {
      return { ext: 'jpg', mime: 'image/jpeg', height: b.readUInt16BE(pos + 3), width: b.readUInt16BE(pos + 5) };
    }
    pos += len;
  }
  return null;
}

function webpInfo(b) {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('ascii', 12, 16);
  let width;
  let height;
  if (kind === 'VP8 ') {
    width = b.readUInt16LE(26) & 0x3fff;
    height = b.readUInt16LE(28) & 0x3fff;
  } else if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    width = (bits & 0x3fff) + 1;
    height = ((bits >> 14) & 0x3fff) + 1;
  } else if (kind === 'VP8X') {
    width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
  } else return null;
  return { ext: 'webp', mime: 'image/webp', width, height };
}

/** @returns {{ext:string, mime:string, width:number, height:number}|null} */
export function sniffImage(buffer) {
  return pngInfo(buffer) || jpegInfo(buffer) || webpInfo(buffer);
}

/** Decode and validate a `data:image/...;base64,` URL. */
export function decodeDataUrl(encoded) {
  if (typeof encoded !== 'string' || encoded.length > MAX_BYTES * 1.4 + 100) throw badRequest('That image is too large.');
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(encoded);
  if (!m) throw badRequest('Choose a JPEG, PNG or WebP image.');
  const data = Buffer.from(m[2], 'base64');
  if (!data.length || data.length > MAX_BYTES) throw badRequest('That image is too large. Photos are resized automatically; try another one.');
  const info = sniffImage(data);
  if (!info) throw badRequest('That file is not a valid image.');
  if (info.width < 1 || info.height < 1 || info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) {
    throw badRequest(`Images can be at most ${MAX_DIMENSION}px wide or tall.`);
  }
  return { data, info };
}

export function createImageStore(dataDir) {
  const dir = path.join(dataDir, 'uploads');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  return {
    dir,
    /** @returns {{name:string, info:object}} */
    save(encoded) {
      const { data, info } = decodeDataUrl(encoded);
      const name = `g_${crypto.randomBytes(16).toString('hex')}.${info.ext}`;
      fs.writeFileSync(path.join(dir, name), data, { mode: 0o600, flag: 'wx' });
      return { name, info };
    },
    /** Absolute path for a stored name, or null if the name is not one we issued. */
    pathFor(name) {
      return NAME_RE.test(name || '') ? path.join(dir, name) : null;
    },
    remove(name) {
      const file = this.pathFor(name);
      if (!file) return;
      try {
        fs.unlinkSync(file);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    },
    mimeFor(name) {
      return name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    }
  };
}
