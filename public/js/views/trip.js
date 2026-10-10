import { html, useState } from '/js/ui.js';
import { t, tn } from '/js/i18n.js';
import { api } from '/js/api.js';
import { useStore, toast, fail, openUpgrade } from '/js/store.js';
import { Icon, weatherIcon } from '/js/icons.js';
import { Sheet, LocationPicker, Spinner } from '/js/components/common.js';
import { OutfitArt, GarmentArt } from '/js/components/art.js';
import { NoLocation, EmptyCloset } from '/js/views/today.js';
import { describeCode } from '/shared/weather-codes.js';
import { CATEGORIES, OCCASIONS } from '/shared/taxonomy.js';
import { dow, tempStr, longDate } from '/js/format.js';

const CAT_ORDER = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];

const packText = (r) =>
  CAT_ORDER.map((cat) => {
    const rows = r.pack.filter((p) => p.item.category === cat);
    return rows.length ? `${t(CATEGORIES[cat].label)}\n${rows.map((p) => `[ ] ${p.item.name}`).join('\n')}` : '';
  })
    .filter(Boolean)
    .join('\n\n');

function Checklist({ result }) {
  const storeKey = `mw.pack.${result.pack.map((p) => p.item.id.slice(0, 6)).join('')}`.slice(0, 120);
  const [done, setDone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) || '[]');
    } catch {
      return [];
    }
  });
  const toggle = (id) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* private mode: the ticks just won't be remembered */
    }
  };
  return html`<div class="stack">
    ${CAT_ORDER.map((cat) => {
      const rows = result.pack.filter((p) => p.item.category === cat);
      if (!rows.length) return null;
      return html`<div class="stack" style=${{ gap: '4px' }} key=${cat}>
        <span class="eyebrow">${t(CATEGORIES[cat].label)}</span>
        <ul class="ins-list">${rows.map((p) => html`<li class="pack-row" key=${p.item.id}>
          <label class="pack-check"><input type="checkbox" checked=${done.includes(p.item.id)} onChange=${() => toggle(p.item.id)} /><span class="sr-only">${p.item.name}</span></label>
          <span class="ins-thumb">${p.item.imageUrl ? html`<img class=${/\.png/.test(p.item.imageUrl) ? 'cutout' : ''} src=${p.item.imageUrl} alt="" loading="lazy" />` : html`<${GarmentArt} type=${p.item.type} color=${p.item.color} />`}</span>
          <span class="stack" style=${{ gap: '1px', minWidth: 0 }}><b class=${`ins-name ${done.includes(p.item.id) ? 'struck' : ''}`}>${p.item.name}</b><span class="small muted">${p.usedOn.map((d) => dow(d)).join(' · ')}</span></span>
        </li>`)}</ul>
      </div>`;
    })}
  </div>`;
}

/** Pack for a trip: the fewest pieces that cover every day, for the destination's weather. */
export function TripView() {
  const { profile, entitlements } = useStore();
  const [dest, setDest] = useState(null); // null = home
  const [picking, setPicking] = useState(false);
  const [startOffset, setStartOffset] = useState(0);
  const [days, setDays] = useState(3);
  const [occasions, setOccasions] = useState(['casual']);
  const [seed, setSeed] = useState(1);
  const [s, setS] = useState({ loading: false, data: null, error: null });
  const planDays = entitlements?.planDays ?? 3;
  const place = dest || profile?.location;

  const build = async (nextSeed = seed) => {
    if (days > planDays) return openUpgrade('plan');
    setS((p) => ({ ...p, loading: true, error: null }));
    try {
      const data = await api.post('/trips/plan', { ...(dest ? { location: { name: dest.name, lat: dest.lat, lon: dest.lon } } : {}), startOffset, days, occasions, seed: String(nextSeed) });
      setS({ loading: false, data, error: null });
    } catch (error) {
      setS({ loading: false, data: null, error });
      if (error.status !== 402) fail(error);
    }
  };

  if (!profile?.location) return html`<${NoLocation} />`;
  const { data, loading } = s;
  const toggleOcc = (id) => setOccasions((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : cur.length < 3 ? [...cur, id] : cur));
  const startLabel = (i) => (i === 0 ? t('Today') : i === 1 ? t('Tomorrow') : t('In {n} days', { n: i }));

  const copy = async () => {
    const text = `${t('Packing list')}: ${data.destination.name}\n\n${packText(data)}`;
    try {
      if (navigator.share) await navigator.share({ title: t('Packing list'), text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t('Copied. Paste it into your notes.'));
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast(t('Could not copy the list.'), { kind: 'err' });
    }
  };

  return html`<div class="stack-l">
    <header class="stack enter" style=${{ gap: '8px' }}>
      <h1 class="display h-xl">${t('Pack for a trip')}</h1>
      <p class="muted" style=${{ maxWidth: '58ch' }}>${t('Tell us where and for how long. We pick the fewest pieces from your closet that work for every day’s weather, so you pack light.')}</p>
    </header>

    <section class="card card-pad stack-l enter">
      <div class="field"><span class="label">${t('Where to?')}</span>
        <button class="btn btn-outline" style=${{ justifyContent: 'space-between' }} onClick=${() => setPicking(true)}><span class="row"><${Icon} name="pin" />${place?.name}</span><${Icon} name="right" /></button>
        ${dest ? html`<button class="btn btn-ghost btn-s" style=${{ justifySelf: 'start' }} onClick=${() => setDest(null)}>${t('Use my home location')}</button>` : null}
      </div>
      <div class="size-row">
        <div class="field"><label for="trip-start">${t('Leaving')}</label>
          <select id="trip-start" class="select" value=${startOffset} onChange=${(e) => setStartOffset(Number(e.target.value))}>${Array.from({ length: 8 }, (_, i) => html`<option key=${i} value=${i}>${startLabel(i)}</option>`)}</select></div>
        <div class="field"><label for="trip-days">${t('For how many days?')}</label>
          <select id="trip-days" class="select" value=${days} onChange=${(e) => setDays(Number(e.target.value))}>${Array.from({ length: 8 }, (_, i) => html`<option key=${i + 1} value=${i + 1}>${i + 1 > planDays ? `${tn(i + 1, '{n} day', '{n} days')} · Pro` : tn(i + 1, '{n} day', '{n} days')}</option>`)}</select></div>
      </div>
      <div class="field"><span class="label">${t('What will you dress for?')}</span>
        <div class="row-wrap" role="group" aria-label=${t('Occasion')}>${Object.entries(OCCASIONS).map(([id, o]) => html`<button key=${id} class="chip" aria-pressed=${occasions.includes(id) ? 'true' : 'false'} onClick=${() => toggleOcc(id)}>${t(o.label)}</button>`)}</div>
        <span class="hint">${t('Pick up to three. Each day gets an outfit for each.')}</span></div>
      <div><button class="btn btn-primary" onClick=${() => build()} disabled=${loading}>${loading ? html`<${Spinner} />` : html`<${Icon} name="bag" />`}${t('Build my packing list')}</button></div>
    </section>

    ${s.error && s.error.status !== 402 ? html`<div class="card card-pad center muted">${s.error.message}</div>` : null}

    ${data && !data.plan.length ? html`<${EmptyCloset} missing=${['top', 'bottom']} onDone=${() => build()} />` : null}

    ${data && data.plan.length
      ? html`<div class="stack-l" style=${{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
          <section class="card card-pad stack enter">
            <div class="spread" style=${{ flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
              <div class="stack" style=${{ gap: '2px' }}>
                <span class="eyebrow">${data.destination.name}</span>
                <h2 class="display h-l">${tn(data.pieces, '{n} piece', '{n} pieces')} ${t('for {n} days', { n: data.covered })}</h2>
                <p class="muted small">${t('Each piece is worn {n} times on average.', { n: data.avgWears })}${data.covered < data.requested ? ` ${t('The forecast only reaches {n} days, so that is what we planned for.', { n: data.covered })}` : ''}</p>
              </div>
              <div class="row-wrap"><button class="btn btn-outline btn-s" onClick=${copy}><${Icon} name="share" size="14" />${t('Copy the list')}</button><button class="btn btn-ghost btn-s" onClick=${() => { const n = seed + 1; setSeed(n); build(n); }} disabled=${loading}><${Icon} name="refresh" size="14" />${t('Another combination')}</button></div>
            </div>
            <div class="trip-days">${data.plan.filter((p, i, a) => a.findIndex((x) => x.date === p.date) === i).map((p) => {
              const c = describeCode(p.weather.code);
              return html`<span class="trip-day" key=${p.date}><b class="small">${dow(p.date)}</b><${Icon} name=${weatherIcon(c.condition)} size="16" /><span class="small num">${tempStr(p.weather.tMaxC, data.units)} <span class="faint">${tempStr(p.weather.tMinC, data.units)}</span></span></span>`;
            })}</div>
            ${data.digest.wetDates.length ? html`<p class="small muted"><${Icon} name="umbrella" size="14" /> ${t('Rain on {days}: bring something waterproof.', { days: data.digest.wetDates.map((d) => dow(d)).join(', ') })}</p>` : null}
          </section>

          <section class="card card-pad stack enter"><h2 class="display h-s">${t('Pack this')}</h2><${Checklist} result=${data} /></section>

          <section class="stack enter"><h2 class="display h-s">${t('What to wear each day')}</h2>
            <div class="trip-outfits">${data.plan.map((p) => html`<article class="card trip-outfit" key=${`${p.date}-${p.occasion}`}>
              <div class="trip-art"><${OutfitArt} items=${p.outfit.items} /></div>
              <div class="stack" style=${{ gap: '2px', padding: '12px 14px 14px' }}><b>${longDate(p.date)}</b><span class="eyebrow">${t(OCCASIONS[p.occasion].label)}</span><span class="small muted">${p.outfit.items.map((i) => i.name).join(', ')}</span></div>
            </article>`)}</div>
          </section>
        </div>`
      : null}

    ${picking ? html`<${Sheet} title=${t('Where to?')} onClose=${() => setPicking(false)}><${LocationPicker} onPick=${(l) => { setDest(l); setPicking(false); }} /></${Sheet}>` : null}
  </div>`;
}
