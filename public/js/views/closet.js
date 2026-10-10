import { html, useState, useEffect, useRef, useMemo } from '/js/ui.js';
import { t, tn, getLocale } from '/js/i18n.js';
import { api } from '/js/api.js';
import { useStore, loadCloset, upsertGarment, removeGarment, toast, fail, openUpgrade, state } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { GarmentArt } from '/js/components/art.js';
import { Sheet, Spinner, Empty, Switch } from '/js/components/common.js';
import { CATEGORIES, TYPES, typesFor, PATTERNS, WARMTH_LABELS, FORMALITY_LABELS } from '/shared/taxonomy.js';
import { PALETTE, colorName, dominantColor } from '/shared/color.js';
import { cap } from '/js/format.js';
import { useQuery, navigate } from '/js/router.js';
import { readPhoto } from '/js/photo.js';
import { BulkAddSheet } from '/js/views/bulk.js';
import { CUTOUT_MESSAGES } from '/shared/cutout.js';
import { idleInfo, isDormant, dormantPieces, agoText } from '/shared/dormancy.js';
import { todayLocal } from '/js/format.js';

/** Suggested name for a new piece, in the person's language: "Navy T-shirt". */
const garmentName = (color, type) => t('{color} {type}', { color: cap(t(color)), type: t(TYPES[type].label).toLowerCase() });

const CAT_ORDER = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];

/** "Last worn 3 weeks ago" / "Not worn yet", plus how long it has been waiting when that is notable. */
export function wornLine(g, today = todayLocal()) {
  const { days, never } = idleInfo(g, today);
  if (never) return days >= 14 ? t('Not worn yet · added {when}', { when: agoText(days, getLocale()) }) : t('Not worn yet');
  return t('Last worn {when}', { when: agoText(days, getLocale()) });
}

function Tile({ g, onOpen, onFav, onRemove, today }) {
  const dormant = isDormant(g, today);
  return html`<div class="tile enter">
    <button class="tile-btn" onClick=${() => onOpen(g)} aria-label=${t('Edit {name}', { name: g.name })}>
      <div class="tile-art">${g.imageUrl ? html`<img class=${/\.png/.test(g.imageUrl) ? 'cutout' : ''} src=${g.imageUrl} alt="" loading="lazy" decoding="async" />` : html`<${GarmentArt} type=${g.type} color=${g.color} pattern=${g.pattern} />`}</div>
      <div class="tile-meta">
        <span class="tile-name">${g.name}</span>
        <span class="tile-sub">${t(TYPES[g.type]?.label || '')}${g.wearCount ? ` · ${t('worn {n}×', { n: g.wearCount })}` : ''}</span>
        <span class=${`tile-sub tile-idle ${dormant ? 'dormant' : ''}`}>${wornLine(g, today)}</span>
      </div>
    </button>
    ${dormant ? html`<span class="idle-pill" title=${t('Not worn in a while')}><${Icon} name="clock" size="12" />${t('Idle')}</span>` : null}
    <button class=${`fav ${g.favorite ? 'on' : ''}`} onClick=${() => onFav(g)} aria-label=${g.favorite ? t('Remove from favourites') : t('Add to favourites')} aria-pressed=${g.favorite ? 'true' : 'false'}><${Icon} name="heart" /></button>
    <button class="remove" onClick=${() => onRemove(g)} aria-label=${t('Remove {name}', { name: g.name })} title=${t('Remove from closet')}><${Icon} name="trash" /></button>
  </div>`;
}

/** The pieces that have gone longest without being worn, with one-tap ways to put them back to use. */
function Forgotten({ pieces, onWear, onStyle, onShow }) {
  const shown = pieces.slice(0, 6);
  return html`<section class="card card-pad stack enter forgotten" aria-label=${t('Not worn in a while')}>
    <div class="spread" style=${{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
      <div class="stack" style=${{ gap: '2px' }}>
        <span class="eyebrow">${t('Not worn in a while')}</span>
        <p class="muted small">${tn(pieces.length, '{n} piece is waiting for its turn.', '{n} pieces are waiting for their turn.')}</p>
      </div>
      ${pieces.length > shown.length ? html`<button class="btn btn-ghost btn-s" onClick=${onShow}>${t('See all {n}', { n: pieces.length })}</button>` : null}
    </div>
    <div class="forgotten-row">
      ${shown.map((g) => html`<div class="forgotten-item" key=${g.id}>
        <div class="forgotten-art">${g.imageUrl ? html`<img class=${/\.png/.test(g.imageUrl) ? 'cutout' : ''} src=${g.imageUrl} alt="" loading="lazy" decoding="async" />` : html`<${GarmentArt} type=${g.type} color=${g.color} pattern=${g.pattern} />`}</div>
        <b class="small forgotten-name">${g.name}</b>
        <span class="small muted">${wornLine(g)}</span>
        <div class="row" style=${{ gap: '6px', flexWrap: 'wrap' }}>
          <button class="btn btn-outline btn-s" onClick=${() => onStyle(g)}><${Icon} name="sparkle" size="14" />${t('Style it')}</button>
          <button class="btn btn-ghost btn-s" onClick=${() => onWear(g)} title=${t('I wore this today')}><${Icon} name="check" size="14" />${t('Wore it today')}</button>
        </div>
      </div>`)}
    </div>
  </section>`;
}

function Slider({ label, value, min, max, step = 0.5, labels, onChange, id }) {
  return html`<div class="field">
    <div class="spread"><label for=${id}>${label}</label><span class="small muted">${labels[Math.round(value)] || ''}</span></div>
    <input id=${id} class="range" type="range" min=${min} max=${max} step=${step} value=${value} onInput=${(e) => onChange(Number(e.target.value))} />
  </div>`;
}

/** Wear tracking for one piece: when it was last worn, a one-tap "wore it today", and back-dating. */
function WearHistory({ garment }) {
  const [g, setG] = useState(garment);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const today = todayLocal();
  const log = async (d) => {
    setBusy(true);
    try {
      const { garment: next } = await api.post(`/garments/${g.id}/worn`, { date: d });
      setG(next);
      upsertGarment(next);
      setDate('');
      toast(t('Logged'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const idle = idleInfo(g, today);
  return html`<div class="field wear-history">
    <span class="label">${t('Wear history')}</span>
    <p class=${`small ${isDormant(g, today) ? 'idle-warn' : 'muted'}`}>${g.wearCount ? `${t('worn {n}×', { n: g.wearCount })} · ` : ''}${wornLine(g, today)}${isDormant(g, today) && !idle.never ? ` · ${t('It has been a while. Time to bring it back?')}` : ''}</p>
    <div class="row-wrap" style=${{ alignItems: 'center' }}>
      <button class="btn btn-outline btn-s" onClick=${() => log(today)} disabled=${busy}><${Icon} name="check" size="14" />${t('I wore it today')}</button>
      <label class="sr-only" for="g-wore-on">${t('Date you wore it')}</label>
      <input id="g-wore-on" class="input" type="date" max=${today} value=${date} onInput=${(e) => setDate(e.target.value)} style=${{ width: 'auto', minHeight: '36px', padding: '4px 10px' }} />
      <button class="btn btn-ghost btn-s" onClick=${() => date && log(date)} disabled=${busy || !date}>${t('Log that date')}</button>
    </div>
  </div>`;
}

export function GarmentSheet({ garment, onClose, caps }) {
  const editing = Boolean(garment);
  const [form, setForm] = useState(() => ({
    type: garment?.type || 'tee',
    color: garment?.color || '#1f2f54',
    name: garment?.name || '',
    pattern: garment?.pattern || 'solid',
    warmth: garment?.warmth ?? TYPES.tee.warmth,
    formality: garment?.formality ?? TYPES.tee.formality,
    waterproof: garment?.waterproof ?? false,
    brand: garment?.brand || '',
    notes: garment?.notes || '',
    favorite: garment?.favorite || false
  }));
  const [photos, setPhotos] = useState(null); // { original, cutout, reason } for a newly chosen photo
  const [removeBg, setRemoveBg] = useState(true);
  const [working, setWorking] = useState(false);
  const photo = photos ? (removeBg && photos.cutout ? photos.cutout : photos.original) : null;
  const [preview, setPreview] = useState(garment?.imageUrl || null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [touched, setTouched] = useState({});
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const pickType = (type) => {
    const t = TYPES[type];
    set({ type, ...(touched.warmth ? {} : { warmth: t.warmth }), ...(touched.formality ? {} : { formality: t.formality }), ...(touched.waterproof ? {} : { waterproof: Boolean(t.water) }) });
  };

  const onFile = async (file) => {
    if (!file) return;
    setWorking(true);
    try {
      const p = await readPhoto(file, { removeBackground: true });
      setPhotos({ original: p.original, cutout: p.cutout, reason: p.cutoutReason });
      setRemoveBg(true);
      setRemovePhoto(false);
      if (p.color && !editing) set({ color: p.color });
      if (p.cutoutReason && CUTOUT_MESSAGES[p.cutoutReason]) toast(t(CUTOUT_MESSAGES[p.cutoutReason]), { ms: 6500 });
    } catch (e) {
      toast(e.message, { kind: 'err' });
    } finally {
      setWorking(false);
    }
  };

  const cloudCutout = async () => {
    if (!photos) return;
    setWorking(true);
    try {
      const { image } = await api.post('/photos/cutout', { image: photos.original });
      setPhotos({ ...photos, cutout: image, reason: null });
      setRemoveBg(true);
      toast(t('Background removed'));
    } catch (e) {
      fail(e);
    } finally {
      setWorking(false);
    }
  };

  const analyse = async () => {
    if (!photo) return;
    setAnalysing(true);
    try {
      const { suggestion } = await api.post('/ai/analyze-garment', { image: photo });
      setTouched({});
      set({ type: suggestion.type, color: suggestion.color, name: suggestion.name || form.name, pattern: suggestion.pattern || 'solid', warmth: suggestion.warmth ?? TYPES[suggestion.type].warmth, formality: suggestion.formality ?? TYPES[suggestion.type].formality, waterproof: Boolean(suggestion.waterproof) });
      toast(t('Filled in from your photo. Check it looks right.'));
    } catch (e) {
      fail(e);
    } finally {
      setAnalysing(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...form, brand: form.brand, notes: form.notes };
      if (!body.name) delete body.name;
      let saved;
      if (editing) {
        saved = (await api.patch(`/garments/${garment.id}`, body)).garment;
        if (photo) saved = (await api.put(`/garments/${garment.id}/photo`, { image: photo })).garment;
        else if (removePhoto && garment.imageUrl) saved = (await api.del(`/garments/${garment.id}/photo`)).garment;
      } else {
        saved = (await api.post('/garments', { ...body, ...(photo ? { image: photo } : {}) })).garment;
      }
      upsertGarment(saved);
      toast(editing ? t('Saved') : t('{name} added', { name: saved.name }));
      onClose();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm(t('Remove “{name}” from your closet?', { name: garment.name }))) return;
    setBusy(true);
    try {
      await api.del(`/garments/${garment.id}`);
      removeGarment(garment.id);
      toast(t('Removed'));
      onClose();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  const cname = colorName(form.color);
  return html`<${Sheet} title=${editing ? t('Edit piece') : t('Add a piece')} onClose=${onClose} wide
    footer=${html`${editing ? html`<button class="btn btn-danger" onClick=${del} disabled=${busy} aria-label=${t('Delete')}><${Icon} name="trash" /></button>` : null}<button class="btn btn-primary grow" onClick=${save} disabled=${busy}>${busy ? html`<${Spinner} />` : null}${editing ? t('Save changes') : t('Add to closet')}</button>`}>
    <div class="size-row" style=${{ gridTemplateColumns: 'minmax(0, 220px) 1fr', alignItems: 'start' }}>
      <div class="stack">
        <div class=${`drop ${over ? 'over' : ''}`} role="button" tabindex="0" aria-label=${t('Add a photo')}
          onClick=${() => fileRef.current?.click()}
          onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileRef.current?.click())}
          onDragOver=${(e) => (e.preventDefault(), setOver(true))} onDragLeave=${() => setOver(false)}
          onDrop=${(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0]); }}
          style=${{ aspectRatio: '1', minHeight: 0 }}>
          ${(photo || preview) && !removePhoto ? html`<img class=${photo && removeBg && photos.cutout ? 'cutout' : ''} src=${photo || preview} alt=${t('Your photo')} />` : html`<${GarmentArt} type=${form.type} color=${form.color} pattern=${form.pattern} class="" />`}
          ${working ? html`<span class="drop-busy"><${Spinner} /> ${t('Removing background…')}</span>` : (!(photo || preview) || removePhoto) ? html`<span class="small" style=${{ position: 'absolute', bottom: '12px' }}><${Icon} name="camera" size="14" /> ${t('Add a photo')}</span>` : null}
        </div>
        <input ref=${fileRef} type="file" accept="image/*" capture=${undefined} hidden onChange=${(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        <div class="row-wrap">
          <button class="btn btn-outline btn-s" onClick=${() => fileRef.current?.click()} disabled=${working}><${Icon} name="upload" />${(photo || preview) && !removePhoto ? t('Replace') : t('Upload')}</button>
          ${(photo || preview) && !removePhoto ? html`<button class="btn btn-ghost btn-s" onClick=${() => { setPhotos(null); setPreview(null); setRemovePhoto(true); }}>${t('Remove')}</button>` : null}
        </div>
        ${photos && photos.cutout ? html`<div class="spread"><div><div class="label">${t('Remove background')}</div><div class="hint">${t('Shows just the garment')}</div></div><${Switch} label=${t('Remove background')} checked=${removeBg} onChange=${setRemoveBg} /></div>` : null}
        ${photos && !photos.cutout && photos.reason && caps.cutoutService ? html`<button class="btn btn-outline btn-s" onClick=${cloudCutout} disabled=${working}><${Icon} name="sparkle" />${t('Try high-accuracy removal')}</button>` : null}
        ${photos && !photos.cutout && photos.reason && !caps.cutoutService ? html`<p class="hint">${t('Tip: lay the piece on a plain, contrasting surface for a clean cut-out.')}</p>` : null}
        ${photo && caps.vision ? html`<button class="btn btn-accent btn-s" onClick=${analyse} disabled=${analysing}>${analysing ? html`<${Spinner} />` : html`<${Icon} name="sparkle" />`}${t('Auto-fill from photo')}</button>` : null}
        ${photo && !caps.vision ? html`<p class="hint">${t('Tip: we picked the colour from your photo. Choose the type below.')}</p>` : null}
      </div>

      <div class="stack-l">
        <div class="field">
          <span class="label">${t('What is it?')}</span>
          ${CAT_ORDER.map((cat) => html`<div key=${cat} class="stack" style=${{ gap: '8px', marginTop: '6px' }}>
            <span class="eyebrow">${t(CATEGORIES[cat].label)}</span>
            <div class="type-grid">${typesFor(cat).map((ty) => html`<button key=${ty.id} class="type-opt" aria-pressed=${form.type === ty.id ? 'true' : 'false'} onClick=${() => pickType(ty.id)}><${GarmentArt} type=${ty.id} color=${form.type === ty.id ? form.color : '#b9b4a6'} pattern=${form.type === ty.id ? form.pattern : 'solid'} />${t(ty.label)}</button>`)}</div>
          </div>`)}
        </div>

        <div class="field">
          <div class="spread"><span class="label">${t('Colour')}</span><span class="small muted">${cap(t(cname))}</span></div>
          <div class="swatches">
            ${PALETTE.map((p) => html`<button key=${p.name} class="swatch" style=${{ background: p.hex }} aria-label=${p.name} title=${p.name} aria-pressed=${form.color === p.hex ? 'true' : 'false'} onClick=${() => set({ color: p.hex })}></button>`)}
            <label class="swatch" style=${{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', cursor: 'pointer', overflow: 'hidden' }} title=${t('Custom colour')}><span class="sr-only">${t('Custom colour')}</span><input type="color" value=${form.color} onInput=${(e) => set({ color: e.target.value })} style=${{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} /></label>
          </div>
        </div>

        <div class="field"><label for="g-name">${t('Name')} <span class="faint">${t('(optional)')}</span></label><input id="g-name" class="input" maxlength="80" placeholder=${garmentName(cname, form.type)} value=${form.name} onInput=${(e) => set({ name: e.target.value })} /></div>

        <div class="field"><span class="label">${t('Pattern')}</span><div class="row-wrap">${PATTERNS.map((p) => html`<button key=${p} class="chip chip-s" aria-pressed=${form.pattern === p ? 'true' : 'false'} onClick=${() => set({ pattern: p })}>${t(cap(p))}</button>`)}</div></div>

        <${Slider} id="g-warm" label=${t('Warmth')} value=${form.warmth} min=${0.5} max=${5} labels=${WARMTH_LABELS.map((x) => (x ? t(x) : x))} onChange=${(v) => { setTouched((t) => ({ ...t, warmth: true })); set({ warmth: v }); }} />
        <${Slider} id="g-formal" label=${t('Dressiness')} value=${form.formality} min=${1} max=${5} labels=${FORMALITY_LABELS.map((x) => (x ? t(x) : x))} onChange=${(v) => { setTouched((t) => ({ ...t, formality: true })); set({ formality: v }); }} />

        <div class="spread"><div><div class="label">${t('Waterproof')}</div><div class="hint">${t('Keeps you dry in the rain')}</div></div><${Switch} label=${t('Waterproof')} checked=${form.waterproof} onChange=${(v) => { setTouched((t) => ({ ...t, waterproof: true })); set({ waterproof: v }); }} /></div>
        <div class="spread"><div><div class="label">${t('Favourite')}</div><div class="hint">${t('Favourites are chosen more often')}</div></div><${Switch} label=${t('Favourite')} checked=${form.favorite} onChange=${(v) => set({ favorite: v })} /></div>

        ${editing ? html`<${WearHistory} garment=${garment} />` : null}

        <div class="size-row">
          <div class="field"><label for="g-brand">${t('Brand')}</label><input id="g-brand" class="input" maxlength="40" value=${form.brand} onInput=${(e) => set({ brand: e.target.value })} /></div>
          <div class="field"><label for="g-notes">${t('Notes')}</label><input id="g-notes" class="input" maxlength="300" value=${form.notes} onInput=${(e) => set({ notes: e.target.value })} /></div>
        </div>
      </div>
    </div>
  </${Sheet}>`;
}

export function ClosetView() {
  const { garments, entitlements, capabilities, profile } = useStore();
  const q = useQuery();
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [idleOnly, setIdleOnly] = useState(false);
  const today = todayLocal();
  const [sheet, setSheet] = useState(q.get('add') ? 'add' : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCloset().catch(setError);
  }, []);
  useEffect(() => {
    if (q.get('add')) navigate('/closet', { replace: true });
  }, []);

  const counts = useMemo(() => {
    const c = { all: garments?.length || 0 };
    for (const g of garments || []) c[g.category] = (c[g.category] || 0) + 1;
    return c;
  }, [garments]);

  const dormant = useMemo(() => dormantPieces(garments || [], today), [garments, today]);
  const dormantIds = useMemo(() => new Set(dormant.map((g) => g.id)), [dormant]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (garments || []).filter((g) => (cat === 'all' || g.category === cat) && (!idleOnly || dormantIds.has(g.id)) && (!term || `${g.name} ${g.brand} ${t(TYPES[g.type]?.label || '')} ${t(g.colorName || '')}`.toLowerCase().includes(term)));
    if (sort === 'idle') return [...list].sort((a, b) => idleInfo(b, today).days - idleInfo(a, today).days);
    if (sort === 'worn') return [...list].sort((a, b) => b.wearCount - a.wearCount);
    return list;
  }, [garments, cat, search, sort, idleOnly, dormantIds, today]);

  const limit = entitlements?.closetLimit;
  const full = limit != null && (garments?.length || 0) >= limit;
  const openAdd = () => (full ? openUpgrade('closet') : setSheet('add'));
  const openBulk = () => (full ? openUpgrade('closet') : setSheet('bulk'));

  const remove = async (g) => {
    if (!confirm(t('Remove “{name}” from your closet?', { name: g.name }))) return;
    try {
      await api.del(`/garments/${g.id}`);
      removeGarment(g.id);
      toast(t('Removed {name}', { name: g.name }));
    } catch (e) {
      fail(e);
    }
  };
  const fav = async (g) => {
    upsertGarment({ ...g, favorite: !g.favorite });
    try {
      await api.patch(`/garments/${g.id}`, { favorite: !g.favorite });
    } catch (e) {
      upsertGarment(g);
      fail(e);
    }
  };

  const wearToday = async (g) => {
    try {
      const { garment } = await api.post(`/garments/${g.id}/worn`, { date: today });
      upsertGarment(garment);
      toast(t('Logged. {name} is back in rotation.', { name: g.name }));
    } catch (e) {
      fail(e);
    }
  };
  const styleIt = (g) => navigate(`/?with=${g.id}`);

  const starter = async () => {
    setBusy(true);
    try {
      await api.post('/garments/starter', {});
      await loadCloset(true);
      toast(t('Starter wardrobe added. Replace pieces with your own any time.'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (error) return html`<div class="card card-pad stack center"><p>${error.message}</p><div><button class="btn btn-outline" onClick=${() => (setError(null), loadCloset(true).catch(setError))}>${t('Try again')}</button></div></div>`;
  if (!garments) return html`<div class="stack-l"><div class="skel" style=${{ height: '60px', width: '50%' }}></div><div class="grid">${[1, 2, 3, 4, 5, 6, 7, 8].map((i) => html`<div key=${i} class="skel" style=${{ aspectRatio: '0.85' }}></div>`)}</div></div>`;

  return html`<div class="stack-l">
    <header class="spread enter" style=${{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div class="stack" style=${{ gap: '6px' }}>
        <h1 class="display h-xl">${t('Your closet')}</h1>
        <p class="muted">${limit != null ? t('{count} of {limit} pieces on the free plan', { count: garments.length, limit }) : tn(garments.length, '{n} piece', '{n} pieces')}</p>
      </div>
      <div class="row-wrap">
        <button class="btn btn-outline" onClick=${openBulk}><${Icon} name="upload" />${t('Add several')}</button>
        <button class="btn btn-primary" onClick=${openAdd}><${Icon} name="plus" />${t('Add a piece')}</button>
      </div>
    </header>

    ${full ? html`<div class="upsell enter"><div class="grow"><b>${t('Your closet is full')}</b><p>${t('Pro has no limit, so every piece you own can be part of an outfit.')}</p></div><button class="btn btn-s" onClick=${() => openUpgrade('closet')}>${t('See Pro')}</button></div>` : null}

    ${dormant.length && garments.length ? html`<${Forgotten} pieces=${dormant} onWear=${wearToday} onStyle=${styleIt} onShow=${() => { setCat('all'); setSearch(''); setIdleOnly(true); setSort('idle'); }} />` : null}

    ${garments.length === 0
      ? html`<${Empty} title=${t('Nothing here yet')} text=${t('Start with a starter wardrobe to see the outfits right away, or add your own pieces one by one. A photo is optional: we can pick the colour from it.')}
          art=${html`<${GarmentArt} type="shirt" color="#8fa9c8" /><${GarmentArt} type="chinos" color="#a39a6a" /><${GarmentArt} type="loafers" color="#6b4a32" />`}>
          <div class="row-wrap" style=${{ justifyContent: 'center' }}>
            <button class="btn btn-primary" onClick=${openAdd}><${Icon} name="plus" />${t('Add a piece')}</button>
            <button class="btn btn-outline" onClick=${openBulk}><${Icon} name="upload" />${t('Add several photos at once')}</button>
            <button class="btn btn-outline" onClick=${starter} disabled=${busy}>${busy ? html`<${Spinner} />` : null}${t('Start with a starter wardrobe')}</button>
          </div>
        </${Empty}>`
      : html`<div class="stack enter enter-2">
          <div style=${{ position: 'relative', maxWidth: '420px' }}>
            <input class="input" type="search" placeholder=${t('Search your closet')} aria-label=${t('Search your closet')} value=${search} onInput=${(e) => setSearch(e.target.value)} style=${{ paddingLeft: '42px' }} />
            <${Icon} name="search" size="18" class="faint" style=${{ position: 'absolute', left: '14px', top: '14px' }} />
          </div>
          <div class="chips-scroll" role="group" aria-label=${t('Filter by category')}>
            <button class="chip" aria-pressed=${cat === 'all' ? 'true' : 'false'} onClick=${() => setCat('all')}>All ${counts.all}</button>
            ${CAT_ORDER.filter((c) => counts[c]).map((c) => html`<button key=${c} class="chip" aria-pressed=${cat === c ? 'true' : 'false'} onClick=${() => setCat(c)}>${t(CATEGORIES[c].label)} ${counts[c]}</button>`)}
            ${dormant.length ? html`<button class="chip chip-idle" aria-pressed=${idleOnly ? 'true' : 'false'} onClick=${() => setIdleOnly((v) => !v)}><${Icon} name="clock" size="14" />${t('Not worn lately')} ${dormant.length}</button>` : null}
          </div>
          <div class="row" style=${{ gap: '8px', alignItems: 'center' }}>
            <label class="small muted" for="closet-sort">${t('Sort by')}</label>
            <select id="closet-sort" class="select" style=${{ width: 'auto', minHeight: '36px', padding: '4px 36px 4px 12px' }} value=${sort} onChange=${(e) => setSort(e.target.value)}>
              <option value="recent">${t('Recently added')}</option>
              <option value="idle">${t('Longest unworn')}</option>
              <option value="worn">${t('Most worn')}</option>
            </select>
          </div>
        </div>
        ${shown.length
          ? html`<div class="grid wide">${shown.map((g) => html`<${Tile} key=${g.id} g=${g} today=${today} onOpen=${(x) => setSheet(x)} onFav=${fav} onRemove=${remove} />`)}<button class="tile tile-add" onClick=${openAdd}><${Icon} name="plus" /><span>${t('Add a piece')}</span></button></div>`
          : html`<${Empty} title=${t('No matches')} text=${t('Try a different search or category.')} />`}`}

    ${sheet === 'bulk' ? html`<${BulkAddSheet} room=${limit != null ? Math.max(0, limit - garments.length) : null} vision=${Boolean(capabilities.vision && entitlements?.photoTagging)} onClose=${() => setSheet(null)} />` : null}
    ${sheet && sheet !== 'bulk' ? html`<${GarmentSheet} garment=${sheet === 'add' ? null : sheet} caps=${{ vision: capabilities.vision && entitlements?.photoTagging, cutoutService: capabilities.cutoutService && entitlements?.photoTagging }} onClose=${() => setSheet(null)} />` : null}
  </div>`;
}
