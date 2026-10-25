import { html, useState, useEffect, useRef } from '/js/ui.js';
import { lookupBarcode } from '/js/trackweight/api.js';
import { Spinner } from '/js/trackweight/ui.js';

/** Scan with the camera where the browser can read barcodes (Chrome, Edge, Android); otherwise type the number. */
export function BarcodeScanner({ onPick }) {
  const video = useRef(null);
  const busyRef = useRef(false);
  const lastCode = useRef('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState('starting'); // starting | on | unsupported

  async function find(c) {
    if (busyRef.current || !c) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const f = await lookupBarcode(c);
      onPick({ name: f.name, brand: f.brand, barcode: f.barcode, per100g: f.per100g, servingGrams: f.servingGrams, servingLabel: f.servingLabel, source: 'barcode' });
    } catch (e) {
      setError(e.message);
      lastCode.current = '';
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    let stream;
    let timer;
    let cancelled = false;
    (async () => {
      if (!('BarcodeDetector' in globalThis) || !navigator.mediaDevices?.getUserMedia) return setCamera('unsupported');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        setCamera('on');
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        timer = setInterval(async () => {
          try {
            const [hit] = await detector.detect(video.current);
            if (hit && hit.rawValue !== lastCode.current) {
              lastCode.current = hit.rawValue;
              setCode(hit.rawValue);
              find(hit.rawValue);
            }
          } catch {
            /* the frame was not ready */
          }
        }, 400);
      } catch {
        setCamera('unsupported');
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return html`<div class="stack">
    ${camera !== 'unsupported'
      ? html`<video ref=${video} class="tw-scan" playsinline muted></video>`
      : html`<div class="callout small">Live scanning is not available in this browser, or camera access was declined. Type the number printed under the barcode instead.</div>`}
    ${camera === 'on' ? html`<p class="muted small center">Point the camera at the barcode.</p>` : null}
    <div class="row">
      <input class="input" type="text" inputmode="numeric" placeholder="Barcode number" aria-label="Barcode number" value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      <button class="btn btn-primary" disabled=${busy || code.length < 6} onClick=${() => find(code)}>${busy ? html`<${Spinner} />` : 'Find'}</button>
    </div>
    ${error ? html`<p class="error-text" role="alert">${error}</p>` : null}
  </div>`;
}
