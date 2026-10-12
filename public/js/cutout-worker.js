// Runs background removal off the main thread so the editor stays smooth on phones.
import { segment, renderCutout } from '/shared/cutout.js';

self.onmessage = (e) => {
  const { id, width, height, buffer, split } = e.data;
  try {
    const img = { data: new Uint8ClampedArray(buffer), width, height };
    if (split) {
      // several pieces lying apart in one photo: one cut-out for each
      const seg = segment(img, { split: true });
      if (!seg.ok) return self.postMessage({ id, ok: false, reason: seg.reason });
      const items = seg.items.map((it) => {
        const out = renderCutout(img, it, { maxSide: 900 });
        return { width: out.width, height: out.height, buffer: out.data.buffer, box: out.box };
      });
      return self.postMessage({ id, ok: true, items, skipped: seg.skipped || 0 }, items.map((it) => it.buffer));
    }
    const seg = segment(img);
    if (!seg.ok) return self.postMessage({ id, ok: false, reason: seg.reason, pieces: seg.pieces || 0 });
    const out = renderCutout(img, seg, { maxSide: 900 });
    self.postMessage({ id, ok: true, width: out.width, height: out.height, buffer: out.data.buffer, pieces: seg.pieces || 1 }, [out.data.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, reason: 'error', message: String(err?.message || err) });
  }
};
