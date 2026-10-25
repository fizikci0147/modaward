import { html, useState } from '/js/ui.js';
import { MEALS, add, rememberFood } from '/js/trackweight/db.js';
import { num } from '/js/trackweight/ui.js';

export function ManualFood({ date, meal: initialMeal, onDone }) {
  const [name, setName] = useState('');
  const [serving, setServing] = useState('100');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [save, setSave] = useState(true);
  const [meal, setMeal] = useState(initialMeal);
  const grams = num(serving);
  const valid = num(kcal) > 0 && (name.trim() || !save);

  async function submit() {
    const label = name.trim() || 'Quick add';
    await add('entries', { date, meal, name: label, grams: grams || undefined, kcal: Math.round(num(kcal)), protein: num(p), carbs: num(c), fat: num(f), source: save ? 'custom' : 'quick', createdAt: Date.now() });
    if (save && grams > 0) {
      const k = 100 / grams;
      const per = (n) => Math.round(n * k * 10) / 10;
      await rememberFood({ name: label, custom: true, servingGrams: grams, servingLabel: `${grams} g`, per100g: { kcal: Math.round(num(kcal) * k), protein: per(num(p)), carbs: per(num(c)), fat: per(num(f)) } });
    }
    onDone();
  }

  const field = (id, label, value, set, extra = {}) => html`<div class="field"><label for=${id}>${label}</label><input id=${id} class="input" type="number" inputmode="decimal" min="0" step="any" value=${value} onInput=${(e) => set(e.target.value)} ...${extra} /></div>`;

  return html`<div class="stack">
    <div class="field"><label for="tw-mname">Food name</label><input id="tw-mname" class="input" type="text" maxlength="80" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="For example: homemade lentil soup" /></div>
    <div class="tw-grid2">${field('tw-mserv', 'Serving size (g)', serving, setServing)}${field('tw-mkcal', 'Calories (kcal)', kcal, setKcal)}</div>
    <div class="tw-grid3">${field('tw-mp', 'Protein (g)', p, setP)}${field('tw-mc', 'Carbs (g)', c, setC)}${field('tw-mf', 'Fat (g)', f, setF)}</div>
    <label class="row" style=${{ gap: '10px' }}><input type="checkbox" checked=${save} onChange=${(e) => setSave(e.target.checked)} /> Save to my foods for next time</label>
    <div class="field"><label for="tw-mmeal">Meal</label><select id="tw-mmeal" class="select" value=${meal} onChange=${(e) => setMeal(e.target.value)}>${MEALS.map((x) => html`<option value=${x.id}>${x.label}</option>`)}</select></div>
    <button class="btn btn-primary btn-block" disabled=${!valid} onClick=${submit}>Add to diary</button>
  </div>`;
}
