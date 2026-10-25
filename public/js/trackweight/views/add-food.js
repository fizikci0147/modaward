import { html, useState, useEffect, useMemo } from '/js/ui.js';
import { SEED_FOODS } from '/shared/foods-seed.js';
import { scale } from '/shared/nutrition.js';
import { MEALS, add, savedFoods, rememberFood, useQuery } from '/js/trackweight/db.js';
import { searchFoods } from '/js/trackweight/api.js';
import { Icon, Sheet, Spinner, num } from '/js/trackweight/ui.js';
import { PhotoLog } from '/js/trackweight/views/photo.js';
import { BarcodeScanner } from '/js/trackweight/views/barcode.js';
import { ManualFood } from '/js/trackweight/views/manual.js';

const TABS = [
  ['search', 'Search', 'search'],
  ['photo', 'Photo', 'camera'],
  ['barcode', 'Barcode', 'barcode'],
  ['manual', 'Manual', 'edit']
];

const seedChoice = (f) => ({ name: f.name, per100g: f.per100g, servingLabel: f.servingLabel, servingGrams: f.servingGrams, source: 'library' });
const remoteChoice = (f) => ({ name: f.name, brand: f.brand, barcode: f.barcode, per100g: f.per100g, servingLabel: f.servingLabel, servingGrams: f.servingGrams, source: f.barcode ? 'barcode' : 'search' });
const matches = (hay, q) => q.toLowerCase().split(/\s+/).filter(Boolean).every((tok) => hay.toLowerCase().includes(tok));
const portionKcal = (f) => Math.round(f.per100g.kcal * ((f.servingGrams ?? 100) / 100));

export function AddFood({ date, meal, initialTab = 'search', onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [picked, setPicked] = useState(null);
  return html`<${Sheet} title="Add food" onClose=${onClose}>
    ${picked
      ? html`<${Portion} food=${picked} date=${date} meal=${meal} onBack=${() => setPicked(null)} onDone=${onClose} />`
      : html`
          <div class="tw-tabs" role="tablist">
            ${TABS.map(([id, label, icon]) => html`<button class="chip" role="tab" key=${id} aria-selected=${tab === id} onClick=${() => setTab(id)}><${Icon} name=${icon} />${label}</button>`)}
          </div>
          ${tab === 'search' ? html`<${Search} onPick=${setPicked} />` : null}
          ${tab === 'photo' ? html`<${PhotoLog} date=${date} meal=${meal} onDone=${onClose} />` : null}
          ${tab === 'barcode' ? html`<${BarcodeScanner} onPick=${setPicked} />` : null}
          ${tab === 'manual' ? html`<${ManualFood} date=${date} meal=${meal} onDone=${onClose} />` : null}
        `}
  </${Sheet}>`;
}

function Row({ food, onPick }) {
  return html`<button class="tw-food" onClick=${() => onPick(food)}>
    <span class="grow">
      <span class="tw-food-name">${food.name}${food.custom ? html` <span class="badge badge-ok">mine</span>` : null}</span>
      <span class="tiny faint">${food.brand ? `${food.brand} · ` : ''}${food.servingLabel ?? '100 g'}</span>
    </span>
    <span class="small num"><b>${portionKcal(food)}</b> <span class="faint">kcal</span></span>
  </button>`;
}

function Search({ onPick }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  const saved = useQuery(savedFoods, [], []);
  const categories = useMemo(() => ['All', ...new Set(SEED_FOODS.map((f) => f.category))], []);

  // online databases (Open Food Facts, USDA) after a short pause in typing
  useEffect(() => {
    setRemote([]);
    setRemoteError('');
    if (q.trim().length < 3) return setLoading(false);
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchFoods(q.trim(), ctrl.signal)
        .then((foods) => !ctrl.signal.aborted && setRemote(foods.map(remoteChoice)))
        .catch((e) => !ctrl.signal.aborted && setRemoteError(e.message))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 450);
    return () => (clearTimeout(timer), ctrl.abort());
  }, [q]);

  const query = q.trim();
  const mine = saved.map((f) => ({ ...f, source: f.custom ? 'custom' : 'library' }));
  const seen = new Set();
  const dedupe = (list) => list.filter((f) => ((k) => (seen.has(k) ? false : (seen.add(k), true)))(`${f.name}|${f.brand ?? ''}`.toLowerCase()));
  const local = query ? dedupe([...mine.filter((f) => matches(`${f.name} ${f.brand ?? ''}`, query)), ...SEED_FOODS.filter((f) => matches(f.name, query)).map(seedChoice)]) : [];
  const online = dedupe(remote);

  return html`<div class="stack">
    <input class="input" type="search" placeholder="Search foods and brands" aria-label="Search foods" value=${q} onInput=${(e) => setQ(e.target.value)} data-autofocus />
    ${!query
      ? html`
          ${saved.length ? html`<div class="stack" style=${{ gap: '8px' }}><div class="eyebrow">Recent and my foods</div>${dedupe(mine.slice(0, 12)).map((f, i) => html`<${Row} key=${i} food=${f} onPick=${onPick} />`)}</div>` : null}
          <div class="eyebrow">Food library</div>
          <div class="chips-scroll">${categories.map((c) => html`<button class="chip chip-s" key=${c} aria-pressed=${c === category} onClick=${() => setCategory(c)}>${c}</button>`)}</div>
          <div class="stack" style=${{ gap: '8px' }}>${SEED_FOODS.filter((f) => category === 'All' || f.category === category).map((f) => html`<${Row} key=${f.id} food=${seedChoice(f)} onPick=${onPick} />`)}</div>
        `
      : html`
          <div class="stack" style=${{ gap: '8px' }}>${local.map((f, i) => html`<${Row} key=${`l${i}`} food=${f} onPick=${onPick} />`)}</div>
          ${online.length ? html`<div class="eyebrow">Online databases</div><div class="stack" style=${{ gap: '8px' }}>${online.map((f, i) => html`<${Row} key=${`r${i}`} food=${f} onPick=${onPick} />`)}</div>` : null}
          ${loading ? html`<div class="row faint small" style=${{ justifyContent: 'center' }}><${Spinner} /> Searching online databases…</div>` : null}
          ${remoteError ? html`<p class="small faint center">${remoteError}</p>` : null}
          ${!loading && !local.length && !online.length && !remoteError && query.length >= 3 ? html`<p class="muted center">No matches. Try another word, or add it by hand on the Manual tab.</p>` : null}
        `}
  </div>`;
}

function Portion({ food, date, meal: initialMeal, onBack, onDone }) {
  const hasServing = Boolean(food.servingGrams);
  const [unit, setUnit] = useState(hasServing ? 'serving' : 'g');
  const [amount, setAmount] = useState(hasServing ? '1' : '100');
  const [meal, setMeal] = useState(initialMeal);
  const grams = unit === 'g' ? num(amount) : num(amount) * (food.servingGrams ?? 100);
  const m = scale(food.per100g, grams);

  function changeUnit(next) {
    // keep the same physical quantity when switching between servings and grams
    setAmount(String(next === 'g' ? Math.round(grams) : Math.round((grams / (food.servingGrams ?? 100)) * 100) / 100));
    setUnit(next);
  }

  async function save() {
    await add('entries', { date, meal, name: food.name, brand: food.brand, grams: Math.round(grams * 10) / 10, ...m, source: food.source, createdAt: Date.now() });
    await rememberFood(food);
    onDone();
  }

  return html`<div class="stack">
    <button class="btn btn-ghost btn-s" style=${{ justifySelf: 'start' }} onClick=${onBack}><${Icon} name="left" /> Back</button>
    <div><h3 class="display h-s">${food.name}</h3>${food.brand ? html`<div class="muted small">${food.brand}</div>` : null}</div>
    <div class="tw-grid2">
      <div class="field"><label for="tw-amount">Amount</label><input id="tw-amount" class="input" type="number" inputmode="decimal" min="0" step="any" value=${amount} onInput=${(e) => setAmount(e.target.value)} data-autofocus /></div>
      <div class="field"><label for="tw-unit">Unit</label>
        <select id="tw-unit" class="select" value=${unit} onChange=${(e) => changeUnit(e.target.value)}>
          ${hasServing ? html`<option value="serving">serving (${food.servingLabel})</option>` : null}
          <option value="g">grams</option>
        </select></div>
    </div>
    <div class="card card-pad center">
      <div class="display" style=${{ fontSize: '2.6rem', lineHeight: 1 }}>${m.kcal} <span class="muted" style=${{ fontSize: '1rem', fontFamily: 'var(--font-ui)' }}>kcal</span></div>
      <div class="row tw-macros-line"><span class="tone-protein-text">Protein ${m.protein} g</span><span class="tone-carbs-text">Carbs ${m.carbs} g</span><span class="tone-fat-text">Fat ${m.fat} g</span></div>
      <div class="tiny faint">${Math.round(grams)} g in total · ${food.per100g.kcal} kcal per 100 g</div>
    </div>
    <div class="field"><label for="tw-meal">Meal</label>
      <select id="tw-meal" class="select" value=${meal} onChange=${(e) => setMeal(e.target.value)}>${MEALS.map((x) => html`<option value=${x.id}>${x.label}</option>`)}</select></div>
    <button class="btn btn-primary btn-block" disabled=${grams <= 0} onClick=${save}>Add to diary</button>
  </div>`;
}
