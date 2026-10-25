import { html, useState, useEffect, useRef } from '/js/ui.js';
import { ACTIVITY_LEVELS, bmr, targets, tdee } from '/shared/nutrition.js';
import { clear, exportAll, importAll } from '/js/trackweight/db.js';
import { status } from '/js/trackweight/api.js';
import { num } from '/js/trackweight/ui.js';

export function ProfileView({ initial, onSave, firstRun }) {
  const [p, setP] = useState(initial);
  const [custom, setCustom] = useState(initial.customKcal != null);
  const [server, setServer] = useState(undefined);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  useEffect(() => {
    if (!firstRun) status().then(setServer, () => setServer(null));
  }, []);

  const eff = { ...p, customKcal: custom ? p.customKcal : undefined };
  const t = targets(eff);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const valid = p.age >= 13 && p.age <= 100 && p.heightCm >= 100 && p.heightCm <= 250 && p.weightKg >= 30 && p.weightKg <= 400;

  async function save() {
    await onSave(eff);
    setMsg('Saved');
  }

  async function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `track-weight-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file) {
    if (!file || !confirm('Replace everything on this device with the backup?')) return;
    try {
      await importAll(JSON.parse(await file.text()));
      setMsg('Backup restored');
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      setMsg(e.message);
    }
  }

  const number = (id, label, key, extra = {}) => html`<div class="field"><label for=${id}>${label}</label><input id=${id} class="input" type="number" inputmode=${extra.step ? 'decimal' : 'numeric'} value=${p[key] || ''} onInput=${(e) => set(key, num(e.target.value))} ...${extra} /></div>`;

  return html`<div class="stack">
    <div>
      <h1 class="display h-m">${firstRun ? 'Welcome to Track Weight' : 'Profile and goals'}</h1>
      ${firstRun ? html`<p class="muted" style=${{ marginTop: '8px' }}>Tell us a little about you and we will work out a daily calorie and macro target. You can change it any time. Your diary stays on this device.</p>` : null}
    </div>
    <section class="card card-pad stack">
      <div class="segmented" role="group" aria-label="Sex" style=${{ justifySelf: 'start' }}>
        ${[['female', 'Female'], ['male', 'Male']].map(([id, label]) => html`<button key=${id} aria-pressed=${p.sex === id} onClick=${() => set('sex', id)}>${label}</button>`)}
      </div>
      <div class="tw-grid3">${number('tw-age', 'Age', 'age')}${number('tw-h', 'Height (cm)', 'heightCm')}${number('tw-w', 'Weight (kg)', 'weightKg', { step: 'any' })}</div>
      <div class="field"><label for="tw-act">Daily activity (not counting logged workouts)</label>
        <select id="tw-act" class="select" value=${p.activity} onChange=${(e) => set('activity', e.target.value)}>${Object.entries(ACTIVITY_LEVELS).map(([k, v]) => html`<option value=${k}>${v.label}</option>`)}</select></div>
      <div class="field"><label for="tw-goal">Goal</label>
        <select id="tw-goal" class="select" value=${p.goal} onChange=${(e) => set('goal', e.target.value)}><option value="lose">Lose weight</option><option value="maintain">Maintain weight</option><option value="gain">Gain weight</option></select></div>
      ${p.goal !== 'maintain' ? html`<div class="field"><label for="tw-rate">Pace: ${p.weeklyKg} kg per week</label><input id="tw-rate" class="range" type="range" min="0.25" max="1" step="0.25" value=${p.weeklyKg} onInput=${(e) => set('weeklyKg', Number(e.target.value))} /></div>` : null}
    </section>
    <section class="card card-pad stack" style=${{ gap: '8px' }}>
      <div class="eyebrow">Your daily target</div>
      <div class="display num" style=${{ fontSize: '2.8rem', lineHeight: 1 }}>${t.kcal} <span class="muted" style=${{ fontSize: '1rem', fontFamily: 'var(--font-ui)' }}>kcal</span></div>
      <div class="small muted num">Protein ${t.protein} g · Carbs ${t.carbs} g · Fat ${t.fat} g</div>
      ${valid ? html`<div class="tiny faint num">Resting burn ${Math.round(bmr(p))} kcal · maintenance about ${Math.round(tdee(p))} kcal a day</div>` : null}
      ${t.floored ? html`<div class="callout small">The target was raised to the lowest generally recommended intake (${p.sex === 'male' ? 1500 : 1200} kcal). Choose a gentler pace, or talk to a professional.</div>` : null}
      <label class="row" style=${{ gap: '10px', marginTop: '6px' }}><input type="checkbox" checked=${custom} onChange=${(e) => (setCustom(e.target.checked), e.target.checked && p.customKcal == null && set('customKcal', t.kcal))} /> Set my own calorie target</label>
      ${custom ? html`<input class="input" type="number" inputmode="numeric" aria-label="Your calorie target" value=${p.customKcal ?? ''} onInput=${(e) => set('customKcal', num(e.target.value))} />` : null}
    </section>
    <button class="btn btn-primary btn-block btn-l" disabled=${!valid} onClick=${save}>${firstRun ? 'Get started' : 'Save'}</button>
    ${msg ? html`<p class="small faint center" role="status">${msg}</p>` : null}

    ${!firstRun
      ? html`
          <section class="card card-pad stack">
            <h3 class="display h-s">Photos and food search</h3>
            <p class="small muted">Photo estimates: <b>${server === undefined ? 'checking…' : server === null ? 'server not reachable' : { on: 'ready', signin: 'sign in to ModaWard to use them', pro: 'part of ModaWard Pro', off: 'not switched on for this site' }[server.photo]}</b>
              <br />Generic food database (USDA): <b>${server ? (server.usda ? 'on' : 'off, packaged foods only') : '—'}</b></p>
          </section>
          <section class="card card-pad stack">
            <h3 class="display h-s">Your data</h3>
            <p class="small muted">The diary is stored on this device only. Export a backup to keep it safe or move to a new phone.</p>
            <div class="row">
              <button class="btn btn-outline grow" onClick=${backup}>Export backup</button>
              <button class="btn btn-outline grow" onClick=${() => fileRef.current?.click()}>Import backup</button>
              <input ref=${fileRef} type="file" accept="application/json" hidden onChange=${(e) => (restore(e.target.files?.[0]), (e.target.value = ''))} />
            </div>
            <button class="btn btn-danger" onClick=${async () => confirm('Delete every diary entry, workout, weigh-in and saved food on this device? This cannot be undone.') && (await clear(['entries', 'workouts', 'weights', 'foods']), setMsg('Everything was deleted from this device.'))}>Delete my diary data</button>
          </section>
          <p class="tiny faint center">Track Weight gives general wellness estimates, not medical advice. Photo estimates are approximate. If you have a medical condition or a history of disordered eating, speak to a professional before changing how you eat.</p>`
      : null}
  </div>`;
}
