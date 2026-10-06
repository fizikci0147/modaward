// Runs background removal off the main thread so the editor stays smooth on phones.
import { segment, renderCutout } from '/shared/cutout.js';

self.onmessage = (e) => {
  const { id, width, height, buffer } = e.data;
  try {
    const img = { data: new Uint8ClampedArray(buffer), width, height };
    const seg = segment(img);
    if (!seg.ok) return self.postMessage({ id, ok: false, reason: seg.reason });
    const out = renderCutout(img, seg, { maxSide: 900 });
    self.postMessage({ id, ok: true, width: out.width, height: out.height, buffer: out.data.buffer }, [out.data.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, reason: 'error', message: String(err?.message || err) });
  }
};
