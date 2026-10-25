import { html, useState } from '/js/ui.js';
import { addDays, targets, today } from '/shared/nutrition.js';
import { allWeights, getRange, put, useQuery } from '/js/trackweight/db.js';
import { num } from '/js/trackweight/ui.js';

const dayInitial = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'narrow' });
};

function WeightChart({ points }) {
  if (points.length < 2) return html`<p class="small faint center" style=${{ padding: '18px 0' }}>Log your weight on two or more days to see a trend.</p>`;
  const W = 320;
  const H = 140;
  const pad = 26;
  const kgs = points.map((p) => p.kg);
  const min = Math.min(...kgs) - 0.5;
  const max = Math.max(...kgs) + 0.5;
  const x = (i) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (kg) => H - pad - ((kg - min) / (max - min)) * (H - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  return html`<svg class="tw-chart" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Weight trend">
    <path class="tw-line" d=${d} />
    ${points.map((p, i) => html`<circle class="tw-dot" key=${p.date} cx=${x(i)} cy=${y(p.kg)} r="3.5" />`)}
    <text class="chart-label" x=${pad} y="14">${max.toFixed(1)} kg</text>
    <text class="chart-label" x=${pad} y=${H - 6}>${min.toFixed(1)} kg</text>
    <text class="chart-label" x=${W - pad} y=${H - 6} text-anchor="end">${points[points.length - 1].kg} kg</text>
  </svg>`;
}

export function Progress({ profile, saveProfile }) {
  const [kg, setKg] = useState('');
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const weights = useQuery(allWeights, [], null);
  const week = useQuery(
    async () => {
      const entries = await getRange('entries', days[0], days[6]);
      return days.map((d) => entries.filter((e) => e.date === d).reduce((a, e) => a + e.kcal, 0));
    },
    [days[0]],
    null
  );
  if (!weights || !week) return null;
  const goal = targets(profile).kcal;
  const logged = week.filter((k) => k > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;
  const maxBar = Math.max(goal * 1.25, ...week);
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const valid = num(kg) >= 20 && num(kg) <= 400;

  async function logWeight() {
    if (!valid) return;
    await put('weights', { date: today(), kg: num(kg) });
    await saveProfile({ ...profile, weightKg: num(kg) }); // targets follow the latest weigh-in
    setKg('');
  }

  return html`<div class="stack">
    <h1 class="display h-m">Progress</h1>
    <section class="card card-pad stack">
      <h3 class="display h-s">Weight</h3>
      <div class="row">
        <input class="input" type="number" inputmode="decimal" step="0.1" min="20" max="400" aria-label="Today’s weight in kilograms" placeholder=${`Today’s weight (kg), now ${latest?.kg ?? profile.weightKg}`} value=${kg} onInput=${(e) => setKg(e.target.value)} />
        <button class="btn btn-primary" disabled=${!valid} onClick=${logWeight}>Log</button>
      </div>
      <${WeightChart} points=${weights.slice(-60)} />
      ${latest && first && weights.length > 1 ? html`<p class="small faint center">Change since ${first.date}: <b class="num">${(latest.kg - first.kg > 0 ? '+' : '') + (latest.kg - first.kg).toFixed(1)} kg</b></p>` : null}
    </section>
    <section class="card card-pad">
      <div class="tw-meal-head"><h3 class="display h-s">Calories, last 7 days</h3><span class="small faint num">${avg ? `average ${avg} kcal` : ''}</span></div>
      <svg class="tw-chart" viewBox="0 0 320 150" role="img" aria-label="Calories eaten each day for the last 7 days" style=${{ marginTop: '10px' }}>
        ${days.map((d, i) => {
          const h = (week[i] / maxBar) * 110;
          const over = week[i] > goal * 1.05;
          return html`<g key=${d}>
            <rect class=${`tw-bar ${over ? 'over' : ''} ${week[i] ? '' : 'empty'}`} x=${14 + i * 43} y=${120 - h} width="28" height=${Math.max(h, 0)} rx="5" />
            <text class="chart-label" x=${28 + i * 43} y="140" text-anchor="middle">${dayInitial(d)}</text>
            ${week[i] > 0 ? html`<text class="chart-label" x=${28 + i * 43} y=${114 - h} text-anchor="middle">${week[i]}</text>` : null}
          </g>`;
        })}
        <line class="tw-goal" x1="0" x2="320" y1=${120 - (goal / maxBar) * 110} y2=${120 - (goal / maxBar) * 110} />
        <text class="chart-label" x="318" y=${116 - (goal / maxBar) * 110} text-anchor="end">goal ${goal}</text>
      </svg>
    </section>
  </div>`;
}
