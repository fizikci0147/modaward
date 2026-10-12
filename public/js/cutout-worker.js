// Runs background removal off the main thread so the editor stays smooth on phones.
import { segment, renderCutout } from '/shared/cutout.js';
import { studioFinish } from '/shared/polish.js';

/** The plain cut-out and its studio-finished twin, as transferable buffers. */
function both(out) {
  const plain = { width: out.width, height: out.height, buffer: out.data.buffer };
  let polished = null;
  try {
    // finish a copy: the plain one is kept exactly as cut
    const fin = studioFinish({ data: new Uint8ClampedArray(out.data), width: out.width, height: out.height });
    polished = { width: fin.width, height: fin.height, buffer: fin.data.buffer, turned: fin.turned };
  } catch {
    polished = null; // the finish is a nicety: never lose the cut-out over it
  }
  return { plain, polished };
}

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
        const { plain, polished } = both(out);
        return { ...plain, box: out.box, polished };
      });
      const transfer = items.flatMap((it) => [it.buffer, it.polished?.buffer].filter(Boolean));
      return self.postMessage({ id, ok: true, items, skipped: seg.skipped || 0 }, transfer);
    }
    const seg = segment(img);
    if (!seg.ok) return self.postMessage({ id, ok: false, reason: seg.reason, pieces: seg.pieces || 0 });
    const out = renderCutout(img, seg, { maxSide: 900 });
    const { plain, polished } = both(out);
    self.postMessage({ id, ok: true, ...plain, polished, pieces: seg.pieces || 1 }, [plain.buffer, polished?.buffer].filter(Boolean));
  } catch (err) {
    self.postMessage({ id, ok: false, reason: 'error', message: String(err?.message || err) });
  }
};
