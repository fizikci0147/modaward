import { html, useState, useMemo } from '/js/ui.js';
import { ACTIVITIES } from '/shared/activities.js';
import { exerciseKcal } from '/shared/nutrition.js';
import { add, remove, workoutsFor, useQuery } from '/js/trackweight/db.js';
import { Icon, Sheet, kcalFmt, num } from '/js/trackweight/ui.js';
import { DateBar } from '/js/trackweight/views/diary.js';

function AddWorkout({ date, weightKg, onClose }) {
  const [q, setQ] = useState('');
  const [activityId, setActivityId] = useState('custom');
  const [minutes, setMinutes] = useState('30');
  const [customName, setCustomName] = useState('');
  const [customKcal, setCustomKcal] = useState('');
  const results = useMemo(() => ACTIVITIES.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())), [q]);
  const act = ACTIVITIES.find((a) => a.id === activityId);
  const kcal = act ? exerciseKcal(act.met, weightKg, num(minutes)) : Math.round(num(customKcal));
  const name = act ? act.name : customName.trim();
  return html`<${Sheet} title="Log exercise" onClose=${onClose}>
    <div class="stack">
      <input class="input" type="search" placeholder="Search activities" aria-label="Search activities" value=${q} onInput=${(e) => setQ(e.target.value)} data-autofocus />
      <div class="tw-pick">
        ${results.map((a) => html`<button class="tw-food" key=${a.id} aria-pressed=${a.id === activityId} onClick=${() => setActivityId(a.id)}><span class="grow">${a.name}</span><span class="tiny faint num">MET ${a.met}</span></button>`)}
        <button class="tw-food" aria-pressed=${activityId === 'custom'} onClick=${() => setActivityId('custom')}><span class="grow">Something else: enter the calories myself</span></button>
      </div>
      ${!act ? html`<div class="field"><label for="tw-wn">Activity name</label><input id="tw-wn" class="input" type="text" maxlength="60" value=${customName} onInput=${(e) => setCustomName(e.target.value)} placeholder="For example: padel with friends" /></div>` : null}
      <div class="tw-grid2">
        <div class="field"><label for="tw-wm">Duration (minutes)</label><input id="tw-wm" class="input" type="number" inputmode="numeric" min="0" value=${minutes} onInput=${(e) => setMinutes(e.target.value)} /></div>
        ${!act ? html`<div class="field"><label for="tw-wk">Calories burned</label><input id="tw-wk" class="input" type="number" inputmode="numeric" min="0" value=${customKcal} onInput=${(e) => setCustomKcal(e.target.value)} /></div>` : null}
      </div>
      <div class="card card-pad center"><b class="display tw-bignum" style=${{ fontSize: '2.4rem' }}>${kcal}</b> kcal burned${act ? html`<div class="tiny faint">MET ${act.met} × ${weightKg} kg × ${num(minutes)} min</div>` : null}</div>
      <button class="btn btn-primary btn-block" disabled=${kcal <= 0 || num(minutes) <= 0 || !name} onClick=${async () => (await add('workouts', { date, name, minutes: num(minutes), kcal, createdAt: Date.now() }), onClose())}>Add workout</button>
    </div>
  </${Sheet}>`;
}

export function Exercise({ profile, date, setDate }) {
  const [adding, setAdding] = useState(false);
  const workouts = useQuery(() => workoutsFor(date), [date], null);
  if (!workouts) return null;
  const total = workouts.reduce((a, w) => a + w.kcal, 0);
  const minutes = workouts.reduce((a, w) => a + w.minutes, 0);
  return html`<div class="stack">
    <${DateBar} date=${date} setDate=${setDate} />
    <section class="card card-pad tw-hero tw-two">
      <div class="center"><b class="display num" style=${{ fontSize: '2.4rem' }}>${kcalFmt(total)}</b><div class="small faint">kcal burned</div></div>
      <div class="center"><b class="display num" style=${{ fontSize: '2.4rem' }}>${minutes}</b><div class="small faint">minutes</div></div>
    </section>
    <section class="card card-pad">
      <div class="tw-meal-head"><h3 class="display h-s">Workouts</h3><button class="btn btn-outline btn-s" onClick=${() => setAdding(true)}><${Icon} name="plus" /> Add</button></div>
      ${workouts.map(
        (w) => html`<div class="tw-entry" key=${w.id}>
          <span class="grow"><span class="tw-entry-name">${w.name}</span><span class="tiny faint">${w.minutes} min</span></span>
          <b class="num">${w.kcal}</b>
          <button class="icon-btn" aria-label=${`Delete ${w.name}`} onClick=${() => remove('workouts', w.id)}><${Icon} name="trash" /></button>
        </div>`
      )}
      ${!workouts.length ? html`<p class="small faint" style=${{ paddingTop: '6px' }}>No exercise logged. Calories burned are added to the day’s budget.</p>` : null}
    </section>
    <p class="tiny faint center">Estimated from MET values and your weight (${profile.weightKg} kg). Log a weigh-in in Progress to keep it accurate.</p>
    <button class="tw-fab" aria-label="Log exercise" onClick=${() => setAdding(true)}><${Icon} name="plus" size="26" /></button>
    ${adding ? html`<${AddWorkout} date=${date} weightKg=${profile.weightKg} onClose=${() => setAdding(false)} />` : null}
  </div>`;
}
