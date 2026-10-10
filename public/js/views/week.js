import { html, useState, useEffect } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { api } from '/js/api.js';
import { useStore, fail, openUpgrade, toast } from '/js/store.js';
import { Icon, weatherIcon } from '/js/icons.js';
import { OutfitCard } from '/js/components/outfit.js';
import { Tips } from '/js/components/weather.js';
import { describeCode } from '/shared/weather-codes.js';
import { OCCASIONS } from '/shared/taxonomy.js';
import { dow, dayNum, tempStr, longDate } from '/js/format.js';
import { Link } from '/js/router.js';
import { NoLocation, EmptyCloset } from '/js/views/today.js';

/** What this day is for: pick an occasion (and a few words) and the outfits follow. */
function DayPlan({ day, onChanged }) {
  const plan = day.plan;
  const [open, setOpen] = useState(false);
  const [occ, setOcc] = useState(plan?.occasion || day.occasion);
  const [note, setNote] = useState(plan?.note || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/plans/${day.date}`, { occasion: occ, note: note.trim() });
      try {
        sessionStorage.removeItem('mw.occasion'); // so Today follows the plan
      } catch {
        /* storage blocked */
      }
      setOpen(false);
      onChanged();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    try {
      await api.del(`/plans/${day.date}`);
      setOpen(false);
      setNote('');
      onChanged();
    } catch (e) {
      fail(e);
    }
  };
  if (!open) {
    return plan
      ? html`<div class="plan-banner"><${Icon} name="calendar" size="16" /><span class="grow">${plan.note ? `${plan.note} · ` : ''}${t(OCCASIONS[plan.occasion].label)}</span><button class="btn btn-ghost btn-s" onClick=${() => setOpen(true)}>${t('Edit')}</button><button class="btn btn-ghost btn-s" onClick=${clear}>${t('Remove')}</button></div>`
      : html`<button class="btn btn-ghost btn-s" style=${{ justifySelf: 'start' }} onClick=${() => setOpen(true)}><${Icon} name="calendar" size="14" />${t('What’s on this day?')}</button>`;
  }
  return html`<div class="stack plan-form">
    <span class="label">${t('What’s on this day?')}</span>
    <div class="row-wrap" role="group" aria-label=${t('Occasion')}>${Object.entries(OCCASIONS).map(([id, o]) => html`<button key=${id} class="chip chip-s" aria-pressed=${occ === id ? 'true' : 'false'} onClick=${() => setOcc(id)}>${t(o.label)}</button>`)}</div>
    <label class="sr-only" for="plan-note">${t('A few words (optional)')}</label>
    <input id="plan-note" class="input" maxlength="60" placeholder=${t('A few words (optional)')} value=${note} onInput=${(e) => setNote(e.target.value)} />
    <div class="row-wrap"><button class="btn btn-primary btn-s" onClick=${save} disabled=${busy}>${t('Save')}</button><button class="btn btn-ghost btn-s" onClick=${() => setOpen(false)}>${t('Cancel')}</button></div>
  </div>`;
}

function Locked({ day }) {
  return html`<div class="card locked-card enter">
    <${Icon} name="lock" size="28" />
    <h2 class="display h-m">${t('{date} is part of Pro', { date: longDate(day.date) })}</h2>
    <p class="muted" style=${{ maxWidth: '42ch' }}>${t('Pro plans every day of the week against its own forecast, so you can pack, shop and decide ahead.')}</p>
    <button class="btn btn-primary" onClick=${() => openUpgrade('plan')}>${t('Unlock the full week')}</button>
  </div>`;
}

export function WeekView() {
  const { profile } = useStore();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [sel, setSel] = useState(0);
  const [alt, setAlt] = useState({});
  const [seed, setSeed] = useState(1);
  const [reload, setReload] = useState(0);
  const hasLocation = Boolean(profile?.location);

  useEffect(() => {
    if (!hasLocation) return;
    const ctl = new AbortController();
    setState((p) => ({ ...p, loading: true }));
    api.post('/plan', { seed: String(seed) }, { signal: ctl.signal })
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => error.name !== 'AbortError' && setState({ loading: false, data: null, error }));
    return () => ctl.abort();
  }, [hasLocation, seed, reload]);

  if (!hasLocation) return html`<${NoLocation} />`;
  const { data, loading, error } = state;
  if (error) return html`<div class="card card-pad stack center"><p>${error.message}</p><div><button class="btn btn-outline" onClick=${() => setSeed((x) => x + 1)}>${t('Try again')}</button></div></div>`;
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
      <div class="spread" style=${{ flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
        <h1 class="display h-xl">${t('The week ahead')}</h1>
        <${Link} href="/trip" class="btn btn-outline btn-s"><${Icon} name="bag" size="14" />${t('Packing for a trip?')}</${Link}>
      </div>
      <p class="muted">
        ${wet.length ? (wet.length > 3 ? t('Rain on {days} and more: pack an umbrella.', { days: wet.slice(0, 3).join(', ') }) : t('Rain on {days}: pack an umbrella.', { days: wet.slice(0, 3).join(', ') })) : t('No rain in sight.')}
        ${' '}${t('It ranges from {low} to {high}.', { low: tempStr(digest.coldest.v, units), high: tempStr(digest.hottest.v, units) })}
      </p>
    </header>

    <div class="days enter enter-2" role="group" aria-label=${t('Choose a day')}>
      ${data.days.map((d, i) => {
        const c = describeCode(d.weather.code);
        const wetDay = d.weather.precipProb >= 50;
        return html`<button key=${d.date} class=${`day ${d.locked ? 'locked' : ''}`} aria-pressed=${sel === i ? 'true' : 'false'} onClick=${() => setSel(i)} aria-label=${t('{date}, {condition}, high {temp}', { date: longDate(d.date), condition: t(c.label), temp: tempStr(d.weather.tMaxC, units) })}>
          ${wetDay ? html`<span class="rain-dot" aria-hidden="true"></span>` : null}
          ${d.plan ? html`<span class="plan-dot" aria-hidden="true"></span>` : null}
          <span class="dow">${i === 0 ? t('Today') : dow(d.date)}</span>
          <span class="dnum">${dayNum(d.date)}</span>
          <${Icon} name=${d.locked ? 'lock' : weatherIcon(c.condition)} />
          <span class="hl num">${tempStr(d.weather.tMaxC, units)} <span class="lo">${tempStr(d.weather.tMinC, units)}</span></span>
        </button>`;
      })}
    </div>

    ${day.locked
      ? html`<${Locked} day=${day} />`
      : html`<div class="stack-l" key=${day.date}>
          <div class="card card-pad enter" style=${{ display: 'grid', gap: '14px' }}>
            <div class="spread">
              <div class="stack" style=${{ gap: '2px' }}>
                <span class="eyebrow">${t('{occasion} day', { occasion: t(OCCASIONS[day.occasion].label) })}</span>
                <h2 class="display h-m">${longDate(day.date)}</h2>
              </div>
              <div class="row"><${Icon} name=${weatherIcon(cond.condition)} size="28" /><div class="small"><b>${t(cond.label)}</b><div class="muted num">${t('{low} to {high}', { low: tempStr(w.tMinC, units), high: tempStr(w.tMaxC, units) })}</div></div></div>
            </div>
            <${Tips} tips=${day.tips} />
            <${DayPlan} key=${`${day.date}-${day.plan?.occasion}-${day.plan?.note}`} day=${day} onChanged=${() => setReload((x) => x + 1)} />
          </div>
          ${outfit
            ? html`<${OutfitCard}
                outfit=${outfit}
                occasionLabel=${t(OCCASIONS[day.occasion].label)}
                onWear=${isToday ? async () => {
                  try {
                    await api.post('/outfits/wear', { date: day.date, itemIds: outfit.itemIds, occasion: day.occasion, key: outfit.key });
                    toast(t('Logged. Enjoy the day.'));
                  } catch (e) { fail(e); }
                } : undefined}
                onLove=${async () => { try { await api.post('/outfits/feedback', { itemIds: outfit.itemIds, signal: 'love', key: outfit.key }); toast(t('Noted. More like this.')); } catch (e) { fail(e); } }}
                onDislike=${async () => { try { await api.post('/outfits/feedback', { itemIds: outfit.itemIds, signal: 'dislike', key: outfit.key }); setAlt((a) => ({ ...a, [day.date]: idx + 1 })); toast(t('Got it. Here’s another.')); } catch (e) { fail(e); } }}
                onSeparate=${async (item) => {
                  const others = outfit.items.filter((i) => i.id !== item.id && i.category !== 'accessory').map((i) => i.id);
                  try {
                    await api.post('/outfits/pair-block', { pieceId: item.id, withIds: others });
                    toast(t('Got it. {name} won’t be paired with that look again.', { name: item.name }), {
                      ms: 7000,
                      action: { label: t('Undo'), run: async () => { try { await api.post('/outfits/pair-unblock', { pieceId: item.id, withIds: others }); setReload((x) => x + 1); } catch (e) { fail(e); } } }
                    });
                    setReload((x) => x + 1);
                  } catch (e) { fail(e); }
                }}
                onExclude=${async (item) => {
                  try {
                    await api.patch(`/garments/${item.id}`, { excluded: true });
                    toast(t('{name} won’t be suggested again.', { name: item.name }), {
                      ms: 7000,
                      action: { label: t('Undo'), run: async () => { try { await api.patch(`/garments/${item.id}`, { excluded: false }); setReload((x) => x + 1); } catch (e) { fail(e); } } }
                    });
                    setReload((x) => x + 1);
                  } catch (e) { fail(e); }
                }}
                onShuffle=${() => setAlt((a) => ({ ...a, [day.date]: idx + 1 }))}
                pager=${day.outfits.length > 1 ? html`<div class="dots" style=${{ position: 'absolute', bottom: '16px' }}>${day.outfits.map((_, i) => html`<i key=${i} class=${i === idx % day.outfits.length ? 'on' : ''}></i>`)}</div>` : null} />`
            : html`<${EmptyCloset} missing=${day.missing} onDone=${() => setSeed((x) => x + 1)} />`}
        </div>`}
    ${loading ? html`<div class="center faint small">${t('Refreshing…')}</div>` : null}
  </div>`;
}
