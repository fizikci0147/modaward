import { html, useState, useEffect, useRef } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { L } from '/shared/i18n.js';
import { Sheet, Spinner } from '/js/components/common.js';
import { toast } from '/js/store.js';
import { toPngDataUrl } from '/js/photo.js';
import { dominantColor } from '/shared/color.js';
import { initialMask, paintLine, eraseSimilar, applyMask } from '/shared/touchup.js';
import { studioFinish } from '/shared/polish.js';

const MAX_SIDE = 900;
const BRUSHES = [[L('Small'), 0.012], [L('Medium'), 0.028], [L('Large'), 0.06]];
const TOOLS = [['erase', L('Erase')], ['restore', L('Restore')], ['tap', L('Tap to erase')]];

/**
 * Fix a cut-out by hand. Erase what should go, restore what should stay, or tap a patch of backdrop to erase
 * everything of that colour around it. Works on the original photo, so it also rescues photos the automatic
 * cut-out gave up on. Calls onDone({ image, color }) with a transparent PNG.
 */
export function TouchUp({ original, onDone, onClose }) {
  const canvasRef = useRef(null);
  const st = useRef({ img: null, mask: null, view: null, first: null, undo: [], drawing: null });
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState('erase');
  const [brush, setBrush] = useState(1);
  const [tolerance, setTolerance] = useState(16);
  const [steps, setSteps] = useState(0);
  const [busy, setBusy] = useState(false);

  const paint = (box) => {
    const s = st.current;
    const canvas = canvasRef.current;
    if (!s.img || !canvas || !box || box.w <= 0 || box.h <= 0) return;
    const { width: w } = s.img;
    for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) s.view.data[(y * w + x) * 4 + 3] = s.mask[y * w + x];
    canvas.getContext('2d').putImageData(s.view, 0, 0, box.x, box.y, box.w, box.h);
  };
  const paintAll = () => paint({ x: 0, y: 0, w: st.current.img.width, h: st.current.img.height });

  useEffect(() => {
    let dead = false;
    const image = new Image();
    image.onload = () => {
      if (dead) return;
      const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const w = Math.max(1, Math.round(image.naturalWidth * scale));
      const h = Math.max(1, Math.round(image.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      // let the sheet paint before the (brief) automatic pass
      setTimeout(() => {
        if (dead) return;
        const { mask } = initialMask({ data: img.data, width: w, height: h });
        const s = st.current;
        s.img = { data: img.data, width: w, height: h };
        s.mask = mask;
        s.first = mask.slice();
        s.view = new ImageData(new Uint8ClampedArray(img.data), w, h);
        setReady(true);
      }, 30);
    };
    image.onerror = () => !dead && (toast(t('That photo could not be read. Try a JPEG or PNG.'), { kind: 'err' }), onClose());
    image.src = original;
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    paintAll();
  }, [ready]);

  const at = (e) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
  };
  const remember = () => {
    const s = st.current;
    s.undo.push(s.mask.slice());
    if (s.undo.length > 20) s.undo.shift();
    setSteps(s.undo.length);
  };
  const radius = () => BRUSHES[brush][1] * Math.max(st.current.img.width, st.current.img.height);

  const down = (e) => {
    const s = st.current;
    if (!ready || e.button > 0) return;
    e.preventDefault();
    const [x, y] = at(e);
    if (tool === 'tap') {
      remember();
      const box = eraseSimilar(s.img, s.mask, x, y, tolerance);
      if (box) paint(box);
      else (s.undo.pop(), setSteps(s.undo.length), toast(t('Nothing to erase there. Try a higher setting, or the Erase brush.')));
      return;
    }
    canvasRef.current.setPointerCapture?.(e.pointerId);
    remember();
    s.drawing = [x, y];
    paint(paintLine(s.mask, s.img.width, s.img.height, x, y, x, y, radius(), tool === 'erase' ? 0 : 255));
  };
  const move = (e) => {
    const s = st.current;
    if (!s.drawing) return;
    const [x, y] = at(e);
    paint(paintLine(s.mask, s.img.width, s.img.height, s.drawing[0], s.drawing[1], x, y, radius(), tool === 'erase' ? 0 : 255));
    s.drawing = [x, y];
  };
  const up = () => {
    st.current.drawing = null;
  };

  const undo = () => {
    const s = st.current;
    const prev = s.undo.pop();
    if (!prev) return;
    s.mask = prev;
    setSteps(s.undo.length);
    paintAll();
  };
  const reset = () => {
    const s = st.current;
    remember();
    s.mask = s.first.slice();
    paintAll();
  };

  const done = () => {
    const s = st.current;
    setBusy(true);
    setTimeout(() => {
      try {
        const out = applyMask(s.img, s.mask, { maxSide: MAX_SIDE });
        if (!out) {
          toast(t('Nothing is left of the piece. Restore some of it first.'), { kind: 'err' });
          return;
        }
        const plain = toPngDataUrl(out.data, out.width, out.height);
        let image = plain;
        try {
          const fin = studioFinish({ data: new Uint8ClampedArray(out.data), width: out.width, height: out.height });
          image = toPngDataUrl(fin.data, fin.width, fin.height);
        } catch {
          /* the finish is a nicety */
        }
        onDone({ image, plain: image === plain ? null : plain, color: dominantColor(out.data, out.width, out.height) });
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const hint = tool === 'erase' ? t('Drag over anything that should not be there.') : tool === 'restore' ? t('Drag over anything that was cut out by mistake.') : t('Tap the background. Everything of that colour around it is erased.');
  return html`<${Sheet} title=${t('Touch up')} onClose=${onClose} wide bodyClass="tu-body"
    footer=${html`<button class="btn btn-ghost" onClick=${onClose}>${t('Cancel')}</button><button class="btn btn-primary grow" onClick=${done} disabled=${!ready || busy}>${busy ? html`<${Spinner} />` : null}${t('Use this cut-out')}</button>`}>
    <div class="tu">
      <div class="tu-stage">
        ${ready ? html`<canvas ref=${canvasRef} width=${st.current.img.width} height=${st.current.img.height} class=${`tu-canvas tu-${tool}`} role="img" aria-label=${t('Your photo')} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onContextMenu=${(e) => e.preventDefault()}></canvas>` : html`<span class="tu-wait"><${Spinner} /> ${t('Removing background…')}</span>`}
      </div>
      <div class="stack">
        <div class="row-wrap" role="group" aria-label=${t('Tool')}>${TOOLS.map(([id, label]) => html`<button key=${id} class="chip" aria-pressed=${tool === id ? 'true' : 'false'} onClick=${() => setTool(id)}>${t(label)}</button>`)}</div>
        <p class="hint" aria-live="polite">${hint}</p>
        ${tool === 'tap'
          ? html`<div class="field"><label for="tu-tol">${t('How alike the colours must be')}</label><input id="tu-tol" type="range" min="4" max="40" step="2" value=${tolerance} onInput=${(e) => setTolerance(Number(e.target.value))} /></div>`
          : html`<div class="field"><span class="label">${t('Brush size')}</span><div class="row-wrap" role="group" aria-label=${t('Brush size')}>${BRUSHES.map(([label], i) => html`<button key=${label} class="chip chip-s" aria-pressed=${brush === i ? 'true' : 'false'} onClick=${() => setBrush(i)}>${t(label)}</button>`)}</div></div>`}
        <div class="row-wrap">
          <button class="btn btn-outline btn-s" onClick=${undo} disabled=${!steps}>${t('Undo')}</button>
          <button class="btn btn-ghost btn-s" onClick=${reset} disabled=${!ready}>${t('Start over')}</button>
        </div>
      </div>
    </div>
  </${Sheet}>`;
}
