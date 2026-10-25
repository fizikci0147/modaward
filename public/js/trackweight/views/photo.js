import { html, useState, useEffect, useRef } from '/js/ui.js';
import { MEALS, add, rememberFood } from '/js/trackweight/db.js';
import { analyzeMeal, status } from '/js/trackweight/api.js';
import { prepareImage } from '/js/trackweight/image.js';
import { Icon, Spinner, num } from '/js/trackweight/ui.js';

const WHY = {
  signin: 'Photo estimates use ModaWard’s AI, so you need to be signed in. Sign in on ModaWard, then come back to this page. Your diary here stays on this device either way.',
  pro: 'Photo estimates are part of ModaWard Pro.',
  off: 'Photo estimates are not switched on for this site yet. Searching, scanning and adding foods by hand all work.'
};

export function PhotoLog({ date, meal: initialMeal, onDone }) {
  const fileRef = useRef(null);
  const [photo, setPhoto] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState('');
  const [meal, setMeal] = useState(initialMeal);
  const [availability, setAvailability] = useState(undefined); // undefined: checking, null: server unreachable

  useEffect(() => {
    status().then((s) => setAvailability(s.photo), () => setAvailability(null));
  }, []);

  async function onFile(file) {
    if (!file) return;
    setError('');
    setRows(null);
    try {
      setPhoto(await prepareImage(file));
    } catch (e) {
      setError(e.message || 'Could not read that image.');
    }
  }

  async function analyse() {
    setBusy(true);
    setError('');
    try {
      const res = await analyzeMeal(photo, hint);
      setNotes(res.notes);
      setRows(res.items.map((i) => ({ ...i, base: i, on: true })));
      if (!res.items.length) setError(res.notes || 'No food was found in that photo.');
    } catch (e) {
      if (e.status === 401) setAvailability('signin');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // changing the grams rescales calories and macros from the model's own estimate
  const setGrams = (idx, grams) =>
    setRows((rs) =>
      rs.map((r, i) => {
        if (i !== idx) return r;
        const f = r.base.grams > 0 ? grams / r.base.grams : 0;
        const x = (n) => Math.round(n * f * 10) / 10;
        return { ...r, grams, kcal: Math.round(r.base.kcal * f), protein_g: x(r.base.protein_g), carbs_g: x(r.base.carbs_g), fat_g: x(r.base.fat_g) };
      })
    );

  const chosen = (rows || []).filter((r) => r.on);
  const total = chosen.reduce((a, r) => a + r.kcal, 0);

  async function save() {
    for (const r of chosen) {
      await add('entries', { date, meal, name: r.name, grams: r.grams, kcal: r.kcal, protein: r.protein_g, carbs: r.carbs_g, fat: r.fat_g, source: 'photo', createdAt: Date.now() });
      if (r.grams > 0) {
        const k = 100 / r.grams;
        const per = (n) => Math.round(n * k * 10) / 10;
        await rememberFood({ name: r.name, servingGrams: r.grams, servingLabel: `${Math.round(r.grams)} g (photo estimate)`, per100g: { kcal: Math.round(r.kcal * k), protein: per(r.protein_g), carbs: per(r.carbs_g), fat: per(r.fat_g) } });
      }
    }
    onDone();
  }

  if (availability === undefined) return html`<div class="row" style=${{ justifyContent: 'center', padding: '30px 0' }}><${Spinner} /></div>`;
  if (availability !== 'on') {
    return html`<div class="callout stack" style=${{ gap: '12px' }}>
      <p>${availability === null ? 'The server is not reachable right now, so photo estimates are unavailable. Searching the built-in library and adding foods by hand still work.' : WHY[availability]}</p>
      ${availability === 'signin' ? html`<a class="btn btn-primary" href="/">Open ModaWard to sign in</a>` : null}
    </div>`;
  }

  return html`<div class="stack">
    <input ref=${fileRef} type="file" accept="image/*" capture="environment" hidden onChange=${(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
    ${!photo
      ? html`<button class="drop tw-drop" onClick=${() => fileRef.current?.click()}>
          <${Icon} name="camera" />
          <b>Take a photo of your meal</b>
          <span class="muted small">or choose one from your gallery. Show the whole plate; a fork or a hand helps with scale.</span>
        </button>`
      : html`<img class="tw-photo" src=${photo} alt="Your meal" />
          ${!rows
            ? html`<div class="field"><label for="tw-hint">Hint (optional): what is it, how much, how was it cooked?</label>
                  <input id="tw-hint" class="input" type="text" maxlength="300" value=${hint} onInput=${(e) => setHint(e.target.value)} placeholder="For example: 2 eggs fried in butter, 1 slice of toast" /></div>
                <div class="row">
                  <button class="btn btn-outline" onClick=${() => fileRef.current?.click()}>Retake</button>
                  <button class="btn btn-primary grow" disabled=${busy} onClick=${analyse}>${busy ? html`<${Spinner} /> Analysing…` : 'Estimate calories'}</button>
                </div>`
            : null}`}
    ${error ? html`<p class="error-text" role="alert">${error}</p>` : null}
    ${rows && rows.length
      ? html`<div class="callout small">Photo estimates can be off by 20% or more. Check each item and correct the grams if you know better.${notes ? html`<br /><i>${notes}</i>` : null}</div>
          ${rows.map(
            (r, i) => html`<div class=${`card card-pad stack tw-photo-row ${r.on ? '' : 'off'}`} key=${i} style=${{ gap: '10px' }}>
              <div class="row" style=${{ justifyContent: 'space-between' }}>
                <label class="row grow" style=${{ gap: '10px' }}><input type="checkbox" checked=${r.on} onChange=${(e) => setRows(rows.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} /><b>${r.name}</b></label>
                <span class=${`tiny tw-conf-${r.confidence}`}>${r.confidence} confidence</span>
              </div>
              <div class="row">
                <div class="field" style=${{ width: '110px' }}><label for=${`tw-g-${i}`}>Grams</label><input id=${`tw-g-${i}`} class="input" type="number" inputmode="decimal" min="0" value=${r.grams || ''} onInput=${(e) => setGrams(i, num(e.target.value))} /></div>
                <div class="grow center"><b class="num" style=${{ fontSize: '1.3rem' }}>${r.kcal}</b> <span class="muted">kcal</span><div class="tiny faint num">P ${r.protein_g} · C ${r.carbs_g} · F ${r.fat_g}</div></div>
              </div>
            </div>`
          )}
          <div class="field"><label for="tw-pmeal">Meal</label><select id="tw-pmeal" class="select" value=${meal} onChange=${(e) => setMeal(e.target.value)}>${MEALS.map((x) => html`<option value=${x.id}>${x.label}</option>`)}</select></div>
          <button class="btn btn-primary btn-block" disabled=${!chosen.length} onClick=${save}>Add ${chosen.length} item${chosen.length === 1 ? '' : 's'} · ${total} kcal</button>`
      : null}
  </div>`;
}
