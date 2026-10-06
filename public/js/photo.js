import { segment, renderCutout } from '/shared/cutout.js';
import { dominantColor } from '/shared/color.js';

let worker;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker('/js/cutout-worker.js', { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (p) (pending.delete(e.data.id), p(e.data));
    };
    worker.onerror = () => {
      worker = null; // fall back to the main thread
      for (const p of pending.values()) p({ ok: false, reason: 'error' });
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

function cutoutInWorker(img) {
  return new Promise((resolve) => {
    const w = getWorker();
    if (!w) {
      // no worker support: run on the main thread after letting the UI paint
      return setTimeout(() => {
        const seg = segment(img);
        if (!seg.ok) return resolve({ ok: false, reason: seg.reason });
        const out = renderCutout(img, seg, { maxSide: 900 });
        resolve({ ok: true, width: out.width, height: out.height, buffer: out.data.buffer });
      }, 30);
    }
    const id = ++seq;
    pending.set(id, resolve);
    const copy = img.data.slice().buffer;
    w.postMessage({ id, width: img.width, height: img.height, buffer: copy }, [copy]);
  });
}

const toPngDataUrl = (data, width, height, maxBytes = 2_600_000) => {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  let url = c.toDataURL('image/png');
  // PNG with alpha can be large; shrink until it fits the server's limit
  for (let scale = 0.8; url.length * 0.75 > maxBytes && scale > 0.3; scale -= 0.15) {
    const s = document.createElement('canvas');
    s.width = Math.round(width * scale);
    s.height = Math.round(height * scale);
    s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
    url = s.toDataURL('image/png');
  }
  return url;
};

/**
 * Read a photo file: resize it, optionally remove the background, and detect the garment colour.
 * Everything happens in the browser; nothing is uploaded until the person saves.
 *
 * @returns {Promise<{original: string, cutout: string|null, cutoutReason: string|null, color: string|null}>}
 */
export async function readPhoto(file, { removeBackground = true } = {}) {
  if (!/^image\//i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error('Choose a photo (JPEG, PNG or WebP).');
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('That photo could not be read. Try a JPEG or PNG.');
  const scale = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const original = canvas.toDataURL('image/jpeg', 0.84);

  let cutout = null;
  let cutoutReason = null;
  let color = null;
  if (removeBackground) {
    const raw = ctx.getImageData(0, 0, w, h);
    const res = await cutoutInWorker({ data: raw.data, width: w, height: h });
    if (res.ok) {
      const data = new Uint8ClampedArray(res.buffer);
      cutout = toPngDataUrl(data, res.width, res.height);
      color = dominantColor(data, res.width, res.height);
    } else {
      cutoutReason = res.reason;
    }
  }
  if (!color) {
    const small = document.createElement('canvas');
    small.width = 48;
    small.height = 48;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(canvas, 0, 0, 48, 48);
    color = dominantColor(sctx.getImageData(0, 0, 48, 48).data, 48, 48);
  }
  return { original, cutout, cutoutReason, color };
}
