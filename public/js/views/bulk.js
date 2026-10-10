import { html, useState, useRef, useEffect } from '/js/ui.js';
import { t, tn } from '/js/i18n.js';
import { api } from '/js/api.js';
import { upsertGarment, toast } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { GarmentArt } from '/js/components/art.js';
import { Sheet, Spinner, Switch } from '/js/components/common.js';
import { CATEGORIES, TYPES, typesFor } from '/shared/taxonomy.js';
import { colorName } from '/shared/color.js';
import { cap } from '/js/format.js';
import { readPhoto } from '/js/photo.js';

const CAT_ORDER = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];
const MAX_FILES = 40;
const TAG_BATCH = 6;

let uid = 0;

/** A small JPEG of a photo, enough for the model to recognise the garment and cheap to send. */
function thumbnail(dataUrl, side = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('thumbnail'));
    img.src = dataUrl;
  });
}

/**
 * Add many pieces at once: pick a pile of photos, we cut out the backgrounds and (with the AI
 * stylist on) recognise each piece, then you check them over on one screen and add them all.
 */
export function BulkAddSheet({ onClose, room, vision, onDone }) {
  const [items, setItems] = useState([]);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef([]); // source of truth, so the async pipeline never works on stale state
  const fileRef = useRef(null);
  const closed = useRef(false);
  const tagChain = useRef(Promise.resolve());
  const warned = useRef(false);

  useEffect(() => () => { closed.current = true; }, []);

  const commit = () => setItems([...ref.current]);
  const patch = (key, p) => {
    ref.current = ref.current.map((it) => (it.key === key ? { ...it, ...p } : it));
    if (!closed.current) commit();
  };

  const tagBatch = async (keys) => {
    const batch = keys.map((k) => ref.current.find((it) => it.key === k)).filter(Boolean);
    if (!batch.length || closed.current) return;
    try {
      const images = await Promise.all(batch.map((it) => thumbnail(it.original)));
      const { suggestions } = await api.post('/ai/analyze-garments', { images });
      batch.forEach((it, i) => {
        const s = suggestions[i];
        const cur = ref.current.find((x) => x.key === it.key);
        if (!cur) return;
        if (!s) return patch(it.key, { tag: 'unsure' });
        // the cut-out's own pixels give a truer colour than a guess from the model
        const keep = cur.cutout && cur.color;
        patch(it.key, { tag: 'ai', type: cur.type || s.type, color: keep ? cur.color : s.color, name: cur.name || s.name || '', pattern: s.pattern, warmth: s.warmth, formality: s.formality, waterproof: s.waterproof });
      });
    } catch (e) {
      if (!warned.current) {
        warned.current = true;
        toast(e.status === 429 ? t('Today’s auto-fill allowance is used up. Choose the types yourself for the rest.') : t('Auto-fill is unavailable right now. Choose the types yourself.'), { kind: 'err', ms: 6000 });
      }
      for (const it of batch) patch(it.key, { tag: 'none' });
    }
  };

  const start = async (fileList) => {
    let files = [...fileList].filter((f) => /^image\//i.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    if (!files.length) return toast(t('Choose photos (JPEG, PNG or WebP).'), { kind: 'err' });
    const space = Math.min(MAX_FILES - ref.current.length, room == null ? Infinity : room - ref.current.length);
    if (space <= 0) return toast(room != null && ref.current.length >= room ? t('Your closet is full. Pro has no limit.') : t('That is plenty for one go. Add these first.'), { kind: 'err' });
    if (files.length > space) {
      toast(room != null && room < MAX_FILES ? t('The free plan has room for {n} more pieces, so we took the first {n}.', { n: space }) : t('We took the first {n} photos.', { n: space }), { ms: 5000 });
      files = files.slice(0, space);
    }
    const fresh = files.map((file) => ({ key: ++uid, file, name: file.name, status: 'reading', tag: vision ? 'pending' : 'none', type: null, color: '#8a8578', pattern: 'solid', warmth: null, formality: null, waterproof: false, label: '', useCutout: true }));
    ref.current = [...ref.current, ...fresh];
    commit();

    let queue = [];
    for (const it of fresh) {
      if (closed.current) return;
      try {
        const p = await readPhoto(it.file, { removeBackground: true });
        if (!ref.current.some((x) => x.key === it.key)) continue; // removed meanwhile
        patch(it.key, { status: 'ready', original: p.original, cutout: p.cutout, color: p.color || '#8a8578', file: null });
        if (vision) {
          queue.push(it.key);
          if (queue.length >= TAG_BATCH) {
            const keys = queue;
            queue = [];
            tagChain.current = tagChain.current.then(() => tagBatch(keys));
          }
        }
      } catch (e) {
        patch(it.key, { status: 'error', error: e.message, tag: 'none', file: null });
      }
    }
    if (queue.length) tagChain.current = tagChain.current.then(() => tagBatch(queue));
  };

  const remove = (key) => {
    ref.current = ref.current.filter((it) => it.key !== key);
    commit();
  };

  const usable = items.filter((it) => it.status === 'ready');
  const reading = items.filter((it) => it.status === 'reading').length;
  const tagging = items.filter((it) => it.tag === 'pending' && it.status !== 'error').length;
  const missing = usable.filter((it) => !it.type).length;
  const busy = reading > 0 || tagging > 0;
  const canAdd = usable.length > 0 && !busy && missing === 0 && !saving;

  const setType = (key, type) => {
    const def = TYPES[type];
    const cur = ref.current.find((it) => it.key === key);
    patch(key, { type, warmth: cur.warmth ?? def.warmth, formality: cur.formality ?? def.formality, waterproof: cur.tag === 'ai' ? cur.waterproof : Boolean(def.water), tag: cur.tag === 'ai' ? 'edited' : cur.tag });
  };

  const addAll = async () => {
    setSaving(true);
    let added = 0;
    for (const it of ref.current.filter((x) => x.status === 'ready')) {
      const def = TYPES[it.type];
      try {
        const { garment } = await api.post('/garments', {
          type: it.type,
          color: it.color,
          pattern: it.pattern,
          warmth: it.warmth ?? def.warmth,
          formality: it.formality ?? def.formality,
          waterproof: it.waterproof,
          ...(it.label.trim() ? { name: it.label.trim() } : it.tag === 'ai' && it.name ? { name: it.name } : {}),
          image: it.useCutout && it.cutout ? it.cutout : it.original
        });
        upsertGarment(garment);
        added += 1;
        remove(it.key);
      } catch (e) {
        patch(it.key, { error: e.message });
        if (e.status === 402) break; // closet limit reached: the rest would fail the same way
      }
    }
    setSaving(false);
    if (added) {
      toast(tn(added, '{n} piece added to your closet', '{n} pieces added to your closet'));
      onDone?.(added);
    }
    if (!ref.current.some((x) => x.status === 'ready')) onClose();
  };

  const close = () => {
    if (ref.current.some((it) => it.status === 'ready') && !saving && !confirm(t('Discard these photos without adding them?'))) return;
    onClose();
  };

  const footer = items.length
    ? html`<div class="stack grow" style=${{ gap: '6px' }}>
        ${missing && !busy ? html`<p class="small" style=${{ color: 'var(--warn)' }}>${tn(missing, 'Choose a type for {n} piece to continue.', 'Choose a type for {n} pieces to continue.')}</p>` : null}
        <button class="btn btn-primary" onClick=${addAll} disabled=${!canAdd}>${saving || busy ? html`<${Spinner} />` : null}${busy ? t('Getting your photos ready…') : saving ? t('Adding…') : tn(usable.length, 'Add {n} piece', 'Add {n} pieces')}</button>
      </div>`
    : null;

  return html`<${Sheet} title=${t('Add several pieces')} onClose=${close} wide footer=${footer}>
    <div class="stack-l">
      <div class=${`drop bulk-drop ${over ? 'over' : ''}`} role="button" tabindex="0" aria-label=${t('Choose photos')} data-autofocus
        onClick=${() => fileRef.current?.click()}
        onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileRef.current?.click())}
        onDragOver=${(e) => (e.preventDefault(), setOver(true))} onDragLeave=${() => setOver(false)}
        onDrop=${(e) => { e.preventDefault(); setOver(false); start(e.dataTransfer.files); }}>
        <${Icon} name="upload" size="22" />
        <b>${items.length ? t('Add more photos') : t('Choose photos from your phone or computer')}</b>
        <span class="small muted">${vision ? t('We remove the backgrounds and recognise each piece. You check them before anything is added.') : t('We remove the backgrounds. Then choose what each piece is and add them all in one go.')}</span>
      </div>
      <input ref=${fileRef} type="file" accept="image/*" multiple hidden onChange=${(e) => { start(e.target.files); e.target.value = ''; }} />

      ${busy ? html`<p class="small muted row" style=${{ gap: '8px' }}><${Spinner} />${reading ? t('Preparing photos… {n} to go', { n: reading }) : t('Recognising your pieces…')}</p>` : null}

      ${items.length
        ? html`<div class="bulk-grid">${items.map((it) => html`<${BulkCard} key=${it.key} it=${it} vision=${vision} onRemove=${() => remove(it.key)} onType=${(ty) => setType(it.key, ty)} onPatch=${(p) => patch(it.key, p)} />`)}</div>`
        : html`<p class="hint">${t('Tip: lay each piece flat on a plain surface, or hang it, one piece per photo. Plain backgrounds give the cleanest cut-outs.')}</p>`}
    </div>
  </${Sheet}>`;
}

function BulkCard({ it, vision, onRemove, onType, onPatch }) {
  const cname = colorName(it.color);
  const src = it.status === 'ready' ? (it.useCutout && it.cutout ? it.cutout : it.original) : null;
  const unsure = it.status === 'ready' && it.tag === 'unsure';
  return html`<div class=${`bulk-card ${it.status === 'ready' && !it.type ? 'need' : ''}`}>
    <div class="bulk-photo">
      ${src ? html`<img class=${it.useCutout && it.cutout ? 'cutout' : ''} src=${src} alt="" />` : it.status === 'error' ? html`<${GarmentArt} type="tee" color="#b9b4a6" />` : html`<span class="bulk-wait"><${Spinner} /></span>`}
      <button class="bulk-x" onClick=${onRemove} aria-label=${t('Remove this photo')}><${Icon} name="x" size="14" /></button>
      ${it.status === 'ready' && it.tag === 'pending' ? html`<span class="bulk-badge">${t('Reading…')}</span>` : null}
      ${it.status === 'ready' && it.tag === 'ai' ? html`<span class="bulk-badge ok"><${Icon} name="sparkle" size="11" />${t('Suggested')}</span>` : null}
    </div>
    ${it.status === 'error'
      ? html`<p class="small" style=${{ color: 'var(--danger)' }}>${it.error}</p>`
      : it.status === 'reading'
        ? html`<p class="small muted">${t('Removing background…')}</p>`
        : html`<div class="stack" style=${{ gap: '8px' }}>
            <label class="sr-only" for=${`bt-${it.key}`}>${t('What is it?')}</label>
            <select id=${`bt-${it.key}`} class="select" value=${it.type || ''} onChange=${(e) => onType(e.target.value)} aria-invalid=${!it.type ? 'true' : 'false'}>
              <option value="" disabled>${unsure ? t('Not sure. Choose a type') : t('Choose a type')}</option>
              ${CAT_ORDER.map((cat) => html`<optgroup key=${cat} label=${t(CATEGORIES[cat].label)}>${typesFor(cat).map((ty) => html`<option key=${ty.id} value=${ty.id}>${t(ty.label)}</option>`)}</optgroup>`)}
            </select>
            <div class="row" style=${{ gap: '8px', alignItems: 'center' }}>
              <label class="bulk-color" style=${{ background: it.color }} title=${t('Colour: {name}', { name: cap(t(cname)) })}><span class="sr-only">${t('Colour')}</span><input type="color" value=${it.color} onInput=${(e) => onPatch({ color: e.target.value })} /></label>
              <span class="small muted bulk-colorname">${cap(t(cname))}</span>
            </div>
            <input class="input" maxlength="80" placeholder=${it.tag === 'ai' && it.name ? it.name : t('Name (optional)')} aria-label=${t('Name')} value=${it.label} onInput=${(e) => onPatch({ label: e.target.value })} />
            ${it.cutout ? html`<div class="spread"><span class="small">${t('Remove background')}</span><${Switch} label=${t('Remove background')} checked=${it.useCutout} onChange=${(v) => onPatch({ useCutout: v })} /></div>` : null}
            ${it.error ? html`<p class="small" style=${{ color: 'var(--danger)' }}>${it.error}</p>` : null}
          </div>`}
  </div>`;
}
