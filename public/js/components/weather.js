import { html } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { Icon, weatherIcon } from '/js/icons.js';
import { describeCode } from '/shared/weather-codes.js';
import { temp, tempStr, hour12, longDate, wind } from '/js/format.js';

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
function smooth(points) {
  if (points.length < 2) return '';
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Temperature curve for the waking day, with rain-probability bars and a marker for now. */
export function DayChart({ hours, units, nowHour }) {
  const W = 640;
  const H = 112;
  const pad = { l: 6, r: 6, t: 18, b: 22 };
  const data = hours.filter((h) => h.hour >= 6 && h.hour <= 22);
  if (data.length < 4) return null;
  const vals = data.map((h) => h.feelsC);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(4, hi - lo);
  const x = (h) => pad.l + ((h - 6) / 16) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
  const pts = data.map((h) => [Math.round(x(h.hour) * 10) / 10, Math.round(y(h.feelsC) * 10) / 10]);
  const line = smooth(pts);
  const area = `${line} L${pts[pts.length - 1][0]} ${H - pad.b} L${pts[0][0]} ${H - pad.b} Z`;
  const minH = data[vals.indexOf(lo)];
  const maxH = data[vals.indexOf(hi)];
  const now = nowHour != null ? data.find((h) => h.hour === Math.min(22, Math.max(6, nowHour))) : null;
  return html`<svg class="chart" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${t('Feels-like temperature from {low} to {high} today', { low: tempStr(lo, units), high: tempStr(hi, units) })} preserveAspectRatio="none" style=${{ overflow: 'visible' }}>
    <defs><linearGradient id="chartfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    ${data.map((h) => (h.precipProb >= 30 ? html`<rect key=${h.hour} x=${x(h.hour) - 7} y=${H - pad.b - 3 - (h.precipProb / 100) * 24} width="14" height=${(h.precipProb / 100) * 24 + 3} rx="3" fill="var(--sky)" opacity=${0.25 + (h.precipProb / 100) * 0.5} />` : null))}
    <path d=${area} fill="url(#chartfill)" />
    <path d=${line} fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    ${[6, 9, 12, 15, 18, 21].map((h) => html`<text key=${h} class="chart-label" x=${x(h)} y=${H - 4} text-anchor="middle">${hour12(h)}</text>`)}
    <text class="chart-label" x=${Math.min(W - 14, Math.max(14, x(minH.hour)))} y=${y(lo) - 9} text-anchor=${minH.hour <= 7 ? 'start' : minH.hour >= 21 ? 'end' : 'middle'} style=${{ fontWeight: 600 }}>${tempStr(lo, units)}</text>
    <text class="chart-label" x=${Math.min(W - 14, Math.max(14, x(maxH.hour)))} y=${y(hi) - 9} text-anchor=${maxH.hour <= 7 ? 'start' : maxH.hour >= 21 ? 'end' : 'middle'} style=${{ fontWeight: 600 }}>${tempStr(hi, units)}</text>
    ${now ? html`<line x1=${x(now.hour)} x2=${x(now.hour)} y1=${y(now.feelsC)} y2=${H - pad.b} stroke="currentColor" stroke-dasharray="2 3" opacity=".5"/><circle cx=${x(now.hour)} cy=${y(now.feelsC)} r="5" fill="var(--surface)" stroke="currentColor" stroke-width="2.4"/>` : null}
  </svg>`;
}

export const heroClass = (cond, isDay) => `w-${cond}${isDay === false ? ' night' : ''}`;

export function WeatherHero({ weather, date, today, children }) {
  const { day, current, location, units } = weather;
  const isToday = Boolean(current);
  const cond = describeCode(isToday ? current.code : day.code);
  const big = isToday ? current.tempC : day.tMaxC;
  const feels = isToday ? current.feelsC : day.feelsMaxC;
  const nowHour = isToday && current.time ? Number(current.time.slice(11, 13)) : null;
  return html`<section class=${`hero ${heroClass(cond.condition, isToday ? current.isDay : true)} enter`} aria-label=${t('Weather')}>
    <div class="hero-grid">
      <div class="stack" style=${{ gap: '14px' }}>
        <div class="row" style=${{ gap: '8px' }}>
          <${Icon} name="pin" size="16" class="faint" />
          <span class="small muted">${location?.name || t('Your location')}${weather.stale ? ` · ${t('offline copy')}` : ''}</span>
        </div>
        <div class="row" style=${{ alignItems: 'flex-end', gap: '16px' }}>
          <div class="hero-temp num" aria-label=${t('{n} degrees', { n: temp(big, units) })}>${temp(big, units)}<sup>°</sup></div>
          <div class="stack" style=${{ gap: '2px', paddingBottom: '8px' }}>
            <${Icon} name=${weatherIcon(cond.condition, isToday ? current.isDay : true)} size="30" />
            <div class="hero-cond">${t(cond.label)}</div>
          </div>
        </div>
        <div class="small muted num">${isToday ? `${t('Feels like {temp}', { temp: tempStr(feels, units) })} · ` : ''}${t('H {temp}', { temp: tempStr(day.tMaxC, units) })} · ${t('L {temp}', { temp: tempStr(day.tMinC, units) })} · ${t('{speed} wind', { speed: wind(day.windKphMax, units) })} · ${t('{n}% rain', { n: Math.round(day.precipProb) })}</div>
        <div class="eyebrow">${longDate(date || day.date)}</div>
      </div>
      <${DayChart} hours=${day.hours} units=${units} nowHour=${nowHour} />
    </div>
    ${children}
  </section>`;
}

export function Tips({ tips }) {
  if (!tips?.length) return null;
  return html`<div class="stack" style=${{ gap: '8px' }}>
    ${tips.map((tip) => html`<div key=${tip.kind} class=${`tip ${tip.kind === 'rain' || tip.kind === 'snow' ? 'rain' : ''}`}><${Icon} name=${tip.icon} /><span>${tip.text}</span></div>`)}
  </div>`;
}
