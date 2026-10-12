import { segment, renderCutout } from '/shared/cutout.js';
import { t } from '/js/i18n.js';
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

function cutoutInWorker(img, split = false) {
  return new Promise((resolve) => {
    const w = getWorker();
    if (!w) {
      // no worker support: run on the main thread after letting the UI paint
      return setTimeout(() => {
        if (split) {
          const seg = segment(img, { split: true });
          if (!seg.ok) return resolve({ ok: false, reason: seg.reason });
          const items = seg.items.map((it) => {
            const out = renderCutout(img, it, { maxSide: 900 });
            return { width: out.width, height: out.height, buffer: out.data.buffer, box: out.box };
          });
          return resolve({ ok: true, items, skipped: seg.skipped || 0 });
        }
        const seg = segment(img);
        if (!seg.ok) return resolve({ ok: false, reason: seg.reason, pieces: seg.pieces || 0 });
        const out = renderCutout(img, seg, { maxSide: 900 });
        resolve({ ok: true, width: out.width, height: out.height, buffer: out.data.buffer, pieces: seg.pieces || 1 });
      }, 30);
    }
    const id = ++seq;
    pending.set(id, resolve);
    const copy = img.data.slice().buffer;
    w.postMessage({ id, width: img.width, height: img.height, buffer: copy, split }, [copy]);
  });
}

export const toPngDataUrl = (data, width, height, maxBytes = 2_600_000) => {
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
 * With `split`, a photo of several pieces lying apart gives one entry per piece in `pieces` (each with its own cropped
 * photo, cut-out and colour). Without it, `pieces` counts how many pieces the photo seems to show.
 *
 * @returns {Promise<{original: string, cutout: string|null, cutoutReason: string|null, color: string|null, pieces: number, found?: {original: string, cutout: string, color: string|null}[], skipped?: number}>}
 */
export async function readPhoto(file, { removeBackground = true, split = false } = {}) {
  if (!/^image\//i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error(t('Choose a photo (JPEG, PNG or WebP).'));
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(t('That photo could not be read. Try a JPEG or PNG.'));
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
  let pieces = 0;
  if (removeBackground && split) {
    const raw = ctx.getImageData(0, 0, w, h);
    const res = await cutoutInWorker({ data: raw.data, width: w, height: h }, true);
    if (res.ok) {
      const found = res.items.map((it) => {
        const data = new Uint8ClampedArray(it.buffer);
        // the piece's own photo: the same crop of the original, so the original and the cut-out always match
        const crop = document.createElement('canvas');
        crop.width = it.box.w;
        crop.height = it.box.h;
        crop.getContext('2d').drawImage(canvas, it.box.x, it.box.y, it.box.w, it.box.h, 0, 0, it.box.w, it.box.h);
        return { original: crop.toDataURL('image/jpeg', 0.84), cutout: toPngDataUrl(data, it.width, it.height), color: dominantColor(data, it.width, it.height) };
      });
      return { original, cutout: null, cutoutReason: null, color: found[0]?.color || null, pieces: found.length, found, skipped: res.skipped || 0 };
    }
    cutoutReason = res.reason;
  } else if (removeBackground) {
    const raw = ctx.getImageData(0, 0, w, h);
    const res = await cutoutInWorker({ data: raw.data, width: w, height: h });
    pieces = res.pieces || 0;
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
  return { original, cutout, cutoutReason, color, pieces };
}
