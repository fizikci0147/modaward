import { html, useState } from '/js/ui.js';
import { sumMacros, targets, addDays, today } from '/shared/nutrition.js';
import { MEALS, entriesFor, workoutsFor, put, remove, useQuery } from '/js/trackweight/db.js';
import { Icon, MacroBar, Ring, Sheet, kcalFmt, num } from '/js/trackweight/ui.js';
import { AddFood } from '/js/trackweight/views/add-food.js';

export function dayLabel(iso) {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function DateBar({ date, setDate }) {
  return html`<div class="tw-datebar">
    <button class="icon-btn" aria-label="Previous day" onClick=${() => setDate(addDays(date, -1))}><${Icon} name="left" /></button>
    <strong class="display h-s">${dayLabel(date)}</strong>
    <button class="icon-btn" aria-label="Next day" disabled=${date >= today()} onClick=${() => setDate(addDays(date, 1))}><${Icon} name="right" /></button>
  </div>`;
}

function EditEntry({ entry, onClose }) {
  const hasGrams = Boolean(entry.grams);
  const [grams, setGrams] = useState(String(entry.grams ?? ''));
  const [kcal, setKcal] = useState(String(entry.kcal));
  const f = hasGrams && num(grams) > 0 ? num(grams) / entry.grams : 1;
  const r = (n) => Math.round(n * f * 10) / 10;
  const preview = hasGrams ? { kcal: Math.round(entry.kcal * f), protein: r(entry.protein), carbs: r(entry.carbs), fat: r(entry.fat) } : { kcal: Math.round(num(kcal)), protein: entry.protein, carbs: entry.carbs, fat: entry.fat };
  return html`<${Sheet} title=${entry.name} onClose=${onClose}>
    <div class="stack">
      ${hasGrams
        ? html`<div class="field"><label for="tw-eg">Amount (g)</label><input id="tw-eg" class="input" type="number" inputmode="decimal" value=${grams} onInput=${(e) => setGrams(e.target.value)} data-autofocus /></div>`
        : html`<div class="field"><label for="tw-ek">Calories (kcal)</label><input id="tw-ek" class="input" type="number" inputmode="decimal" value=${kcal} onInput=${(e) => setKcal(e.target.value)} data-autofocus /></div>`}
      <div class="card card-pad center"><b class="display" style=${{ fontSize: '2rem' }}>${preview.kcal}</b> kcal<div class="tiny faint num">P ${preview.protein} g · C ${preview.carbs} g · F ${preview.fat} g</div></div>
      <button class="btn btn-primary btn-block" disabled=${hasGrams && num(grams) <= 0} onClick=${async () => (await put('entries', { ...entry, ...preview, ...(hasGrams ? { grams: num(grams) } : {}) }), onClose())}>Save</button>
      <button class="btn btn-danger btn-block" onClick=${async () => (await remove('entries', entry.id), onClose())}>Delete entry</button>
    </div>
  </${Sheet}>`;
}

export function Diary({ profile, date, setDate }) {
  const [adding, setAdding] = useState(null);
  const [editing, setEditing] = useState(null);
  const entries = useQuery(() => entriesFor(date), [date], null);
  const workouts = useQuery(() => workoutsFor(date), [date], null);
  // wait for the first read instead of flashing an empty day
  if (!entries || !workouts) return null;

  const t = targets(profile);
  const eaten = sumMacros(entries);
  const burned = workouts.reduce((a, w) => a + w.kcal, 0);
  const remaining = t.kcal + burned - eaten.kcal;
  const defaultMeal = () => ((h) => (h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'))(new Date().getHours());

  return html`<div class="stack">
    <${DateBar} date=${date} setDate=${setDate} />
    <section class="card card-pad">
      <div class="tw-summary">
        <${Ring} value=${eaten.kcal} max=${t.kcal + burned}>
          <b class=${`display num ${remaining < 0 ? 'tw-over' : ''}`}>${kcalFmt(Math.abs(remaining))}</b>
          <span class="tiny faint">${remaining < 0 ? 'kcal over' : 'kcal left'}</span>
        </${Ring}>
        <div class="tw-eq grow">
          <div><b class="num">${kcalFmt(t.kcal)}</b><span class="tiny faint">Goal</span></div>
          <div><b class="num">${kcalFmt(eaten.kcal)}</b><span class="tiny faint">Food</span></div>
          <div><b class="num">${kcalFmt(burned)}</b><span class="tiny faint">Exercise</span></div>
        </div>
      </div>
      <div class="tw-grid3" style=${{ marginTop: '18px' }}>
        <${MacroBar} label="Protein" value=${eaten.protein} target=${t.protein} tone="protein" />
        <${MacroBar} label="Carbs" value=${eaten.carbs} target=${t.carbs} tone="carbs" />
        <${MacroBar} label="Fat" value=${eaten.fat} target=${t.fat} tone="fat" />
      </div>
    </section>

    ${MEALS.map((m) => {
      const list = entries.filter((e) => e.meal === m.id);
      return html`<section class="card card-pad" key=${m.id}>
        <div class="tw-meal-head">
          <h3 class="display h-s">${m.label}</h3>
          <div class="row"><span class="small faint num">${kcalFmt(list.reduce((a, e) => a + e.kcal, 0))} kcal</span>
            <button class="btn btn-outline btn-s" onClick=${() => setAdding({ meal: m.id })}><${Icon} name="plus" /> Add</button></div>
        </div>
        ${list.map(
          (e) => html`<button class="tw-entry" key=${e.id} onClick=${() => setEditing(e)}>
            <span class="grow"><span class="tw-entry-name">${e.name}${e.source === 'photo' ? html` <span class="badge badge-clay">photo estimate</span>` : null}</span>
              <span class="tiny faint">${e.brand ? `${e.brand} · ` : ''}${e.grams ? `${Math.round(e.grams)} g · ` : ''}P ${Math.round(e.protein)} · C ${Math.round(e.carbs)} · F ${Math.round(e.fat)}</span></span>
            <b class="num">${e.kcal}</b>
          </button>`
        )}
        ${!list.length ? html`<p class="small faint" style=${{ paddingTop: '6px' }}>Nothing logged yet.</p>` : null}
      </section>`;
    })}

    <button class="tw-fab" aria-label="Add food" onClick=${() => setAdding({ meal: defaultMeal() })}><${Icon} name="plus" size="26" /></button>
    ${adding ? html`<${AddFood} date=${date} meal=${adding.meal} onClose=${() => setAdding(null)} />` : null}
    ${editing ? html`<${EditEntry} entry=${editing} onClose=${() => setEditing(null)} />` : null}
  </div>`;
}
