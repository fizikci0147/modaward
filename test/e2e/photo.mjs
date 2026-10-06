// Builds a realistic test "photo" (a navy tee lying on a wooden floor with a soft shadow) as a PNG,
// using only Node built-ins, so the e2e test can upload a real file through the real UI.
import zlib from 'node:zlib';
import { rng } from '../../src/engine/rng.js';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function syntheticGarmentPng({ width = 900, height = 900 } = {}) {
  const rand = rng(11);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const inTee = (x, y) => {
    const u = x / width;
    const v = y / height;
    const body = u > 0.32 && u < 0.68 && v > 0.22 && v < 0.82;
    const sleeves = v > 0.22 && v < 0.46 && u > 0.14 && u < 0.86 && Math.abs(u - 0.5) + (v - 0.22) * 0.7 > 0.18;
    const neck = Math.hypot(u - 0.5, v - 0.22) < 0.07;
    return (body || sleeves) && !neck;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r;
      let g;
      let b;
      if (inTee(x, y)) {
        const fold = 8 * Math.sin(x / 23 + y / 41) + (rand() - 0.5) * 6; // fabric shading
        [r, g, b] = [26 + fold, 42 + fold, 92 + fold];
      } else {
        const wood = 120 + 18 * Math.sin(x / 11 + y / 90) + (rand() - 0.5) * 16; // wooden floor
        [r, g, b] = [wood + 42, wood - 4, wood - 48];
        const shadow = Math.max(0, 1 - Math.hypot((x - width * 0.52) / (width * 0.27), (y - height * 0.86) / (height * 0.05)));
        r -= 38 * shadow;
        g -= 38 * shadow;
        b -= 38 * shadow;
      }
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(width, height, rgba);
}
