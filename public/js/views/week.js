import { html, useState, useEffect } from '/js/ui.js';
import { api } from '/js/api.js';
import { useStore, fail, openUpgrade, toast } from '/js/store.js';
import { Icon, weatherIcon } from '/js/icons.js';
import { OutfitCard } from '/js/components/outfit.js';
import { Tips } from '/js/components/weather.js';
import { describeCode } from '/shared/weather-codes.js';
import { OCCASIONS } from '/shared/taxonomy.js';
import { dow, dayNum, tempStr, longDate } from '/js/format.js';
import { NoLocation, EmptyCloset } from '/js/views/today.js';

function Locked({ day }) {
  return html`<div class="card locked-card enter">
    <${Icon} name="lock" size="28" />
    <h2 class="display h-m">${longDate(day.date)} is part of Pro</h2>
    <p class="muted" style=${{ maxWidth: '42ch' }}>Pro plans every day of the week against its own forecast, so you can pack, shop and decide ahead.</p>
    <button class="btn btn-primary" onClick=${() => openUpgrade('plan')}>Unlock the full week</button>
  </div>`;
}

export function WeekView() {
  const { profile } = useStore();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [sel, setSel] = useState(0);
  const [alt, setAlt] = useState({});
  const [seed, setSeed] = useState(1);
  const hasLocation = Boolean(profile?.location);

  useEffect(() => {
    if (!hasLocation) return;
    const ctl = new AbortController();
    setState((p) => ({ ...p, loading: true }));
    api.post('/plan', { seed: String(seed) }, { signal: ctl.signal })
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => error.name !== 'AbortError' && setState({ loading: false, data: null, error }));
    return () => ctl.abort();
  }, [hasLocation, seed]);

  if (!hasLocation) return html`<${NoLocation} />`;
  const { data, loading, error } = state;
  if (error) return html`<div class="card card-pad stack center"><p>${error.message}</p><div><button class="btn btn-outline" onClick=${() => setSeed((x) => x + 1)}>Try again</button></div></div>`;
  if (!data) return html`<div class="stack-l"><div class="skel" style=${{ height: '48px', width: '60%' }}></div><div class="skel" style=${{ height: '120px' }}></div><div class="skel" style=${{ height: '420px' }}></div></div>`;

  const day = data.days[sel];
  const w = day.weather;
  const cond = describeCode(w.code);
  const idx = alt[day.date] || 0;
  const outfit = day.outfits?.[idx % (day.outfits?.length || 1)];
  const { digest, units } = data;
  const wet = digest.wetDates.map((d) => dow(d));
  const isToday = day.date === data.today;

  return html`<div class="stack-l">
    <header class="stack enter" style=${{ gap: '8px' }}>
      <h1 class="display h-xl">The week ahead</h1>
      <p class="muted">
        ${wet.length ? `Rain ${wet.length > 2 ? 'on' : 'on'} ${wet.slice(0, 3).join(', ')}${wet.length > 3 ? ' and more' : ''}: pack an umbrella. ` : 'No rain in sight. '}
        It ranges from ${tempStr(digest.coldest.v, units)} to ${tempStr(digest.hottest.v, units)}.
      </p>
    </header>

    <div class="days enter enter-2" role="group" aria-label="Choose a day">
      ${data.days.map((d, i) => {
        const c = describeCode(d.weather.code);
        const wetDay = d.weather.precipProb >= 50;
        return html`<button key=${d.date} class=${`day ${d.locked ? 'locked' : ''}`} aria-pressed=${sel === i ? 'true' : 'false'} onClick=${() => setSel(i)} aria-label=${`${longDate(d.date)}, ${c.label}, high ${tempStr(d.weather.tMaxC, units)}`}>
          ${wetDay ? html`<span class="rain-dot" aria-hidden="true"></span>` : null}
          <span class="dow">${i === 0 ? 'Today' : dow(d.date)}</span>
          <span class="dnum">${dayNum(d.date)}</span>
          <${Icon} name=${d.locked ? 'lock' : weatherIcon(c.condition)} />
          <span class="hl num">${tempStr(d.weather.tMaxC, units)} <span style=${{ opacity: 0.6 }}>${tempStr(d.weather.tMinC, units)}</span></span>
        </button>`;
      })}
    </div>

    ${day.locked
      ? html`<${Locked} day=${day} />`
      : html`<div class="stack-l" key=${day.date}>
          <div class="card card-pad enter" style=${{ display: 'grid', gap: '14px' }}>
            <div class="spread">
              <div class="stack" style=${{ gap: '2px' }}>
                <span class="eyebrow">${OCCASIONS[day.occasion].label} day</span>
                <h2 class="display h-m">${longDate(day.date)}</h2>
              </div>
              <div class="row"><${Icon} name=${weatherIcon(cond.condition)} size="28" /><div class="small"><b>${cond.label}</b><div class="muted num">${tempStr(w.tMinC, units)} to ${tempStr(w.tMaxC, units)}</div></div></div>
            </div>
            <${Tips} tips=${day.tips} />
          </div>
          ${outfit
            ? html`<${OutfitCard}
                outfit=${outfit}
                occasionLabel=${OCCASIONS[day.occasion].label}
                onWear=${isToday ? async () => {
                  try {
                    await api.post('/outfits/wear', { date: day.date, itemIds: outfit.itemIds, occasion: day.occasion, key: outfit.key });
                    toast('Logged. Enjoy the day.');
                  } catch (e) { fail(e); }
                } : undefined}
                onLove=${async () => { try { await api.post('/outfits/feedback', { itemIds: outfit.itemIds, signal: 'love', key: outfit.key }); toast('Noted. More like this.'); } catch (e) { fail(e); } }}
                onDislike=${async () => { try { await api.post('/outfits/feedback', { itemIds: outfit.itemIds, signal: 'dislike', key: outfit.key }); setAlt((a) => ({ ...a, [day.date]: idx + 1 })); toast('Got it. Here’s another.'); } catch (e) { fail(e); } }}
                onShuffle=${() => setAlt((a) => ({ ...a, [day.date]: idx + 1 }))}
                pager=${day.outfits.length > 1 ? html`<div class="dots" style=${{ position: 'absolute', bottom: '16px' }}>${day.outfits.map((_, i) => html`<i key=${i} class=${i === idx % day.outfits.length ? 'on' : ''}></i>`)}</div>` : null} />`
            : html`<${EmptyCloset} missing=${day.missing} onDone=${() => setSeed((x) => x + 1)} />`}
        </div>`}
    ${loading ? html`<div class="center faint small">Refreshing…</div>` : null}
  </div>`;
}
