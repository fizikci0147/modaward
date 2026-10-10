import { html, useState, useEffect, useRef } from '/js/ui.js';
import { t, tn, getLocale } from '/js/i18n.js';
import { L } from '/shared/i18n.js';
import { api } from '/js/api.js';
import { useStore, updateProfile, toast, fail, logout, refreshMe, profileCompleteness, state, set, forgetThisDevice } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { OutfitArt } from '/js/components/art.js';
import { Sheet, Spinner, LocationPicker, Switch, ProBadge, LanguagePicker } from '/js/components/common.js';
import { ARCHETYPES, PATTERNS, TYPES } from '/shared/taxonomy.js';
import { PALETTE } from '/shared/color.js';
import { AGE_RANGES, FIT_TOPS, FIT_BOTTOMS, BODY_AREAS, SHOP_OCCASIONS, DRESS_CODES, NEVER_TAGS, BUDGET_TIERS, BUDGET_CATEGORIES, CURRENCIES } from '/shared/profile.js';
import { cap, weekdayShort } from '/js/format.js';
import { navigate, useSearch } from '/js/router.js';
import { RemindersSection } from '/js/views/reminders.js';

/** Sample board for each style archetype: drawn, not photographed. */
const SAMPLE = {
  minimal: [['tee', '#f7f6f2'], ['trousers', '#3d3f44'], ['sneakers', '#f7f6f2'], ['lightjacket', '#1c1c1e']],
  classic: [['shirt', '#8fa9c8'], ['chinos', '#a39a6a'], ['loafers', '#6b4a32'], ['blazer', '#1f2f54']],
  casual: [['hoodie', '#8e9096'], ['jeans', '#4b6a93'], ['sneakers', '#f7f6f2'], ['cap', '#b58750']],
  sporty: [['sportstop', '#1f2f54'], ['joggers', '#1c1c1e'], ['runners', '#f7f6f2'], ['fleece', '#3d3f44']],
  street: [['tee', '#1c1c1e', 'graphic'], ['cargo', '#6b6f3a'], ['sneakers', '#f7f6f2'], ['bomber', '#3d3f44']],
  polished: [['blouse', '#efe6d2'], ['trousers', '#1c1c1e'], ['loafers', '#1c1c1e'], ['blazer', '#b58750']],
  boho: [['sundress', '#b5532c', 'floral'], ['sandals', '#b58750'], ['cardigan', '#efe6d2'], ['sunhat', '#cdb89a']]
};
const sampleItems = (id) => SAMPLE[id].map(([type, color, pattern = 'solid']) => ({ type, color, pattern, category: TYPES[type].category }));

const vote = (w) => (w == null ? '' : w >= 0.8 ? 'love' : w <= 0.25 ? 'no' : 'fine');
const WEIGHT = { love: 0.95, fine: 0.6, no: 0.1 };

export function ArchetypeGrid({ value = {}, onChange }) {
  return html`<div class="arch-grid">
    ${Object.entries(ARCHETYPES).map(([id, a]) => {
      const v = vote(value[id]);
      return html`<div key=${id} class=${`arch ${v === 'love' ? 'love' : v === 'no' ? 'no' : ''}`}>
        <div class="art-wrap"><${OutfitArt} items=${sampleItems(id)} label=${t('{style} style', { style: t(a.label) })} /></div>
        <div class="meta"><b>${t(a.label)}</b><div class="tiny faint" style=${{ marginTop: '2px' }}>${t(a.blurb)}</div></div>
        <div class="votes" role="group" aria-label=${t('How do you feel about {style}?', { style: t(a.label) })}>
          <button class="vote" aria-pressed=${v === 'love' ? 'true' : 'false'} onClick=${() => onChange({ ...value, [id]: WEIGHT.love })}>${t('Love')}</button>
          <button class="vote" aria-pressed=${v === 'fine' ? 'true' : 'false'} onClick=${() => onChange({ ...value, [id]: WEIGHT.fine })}>${t('Fine')}</button>
          <button class="vote no" aria-pressed=${v === 'no' ? 'true' : 'false'} onClick=${() => onChange({ ...value, [id]: WEIGHT.no })}>${t('Not me')}</button>
        </div>
      </div>`;
    })}
  </div>`;
}

/** Save status for a section: debounced PATCH with a quiet inline indicator. */
function useSaver() {
  const [status, setStatus] = useState('');
  const timer = useRef();
  const save = (patch) => {
    setStatus('saving');
    updateProfile(patch, { quiet: true })
      .then(() => {
        setStatus('saved');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus(''), 2200);
      })
      .catch(() => setStatus(''));
  };
  return [status, save];
}

const SaveState = ({ status }) => html`<span class="tiny faint" aria-live="polite" style=${{ minHeight: '18px' }}>${status === 'saving' ? t('Saving…') : status === 'saved' ? t('Saved') : ''}</span>`;
const Section = ({ title, blurb, status, children }) => html`<section class="card section-card enter">
  <div class="spread" style=${{ alignItems: 'flex-start' }}><div class="stack" style=${{ gap: '6px' }}><h2 class="display h-m">${title}</h2>${blurb ? html`<p class="muted small" style=${{ maxWidth: '60ch' }}>${blurb}</p>` : null}</div><${SaveState} status=${status} /></div>
  ${children}
</section>`;

function ToggleGroup({ options, value, onChange, multi = false, label }) {
  const on = (id) => (multi ? value.includes(id) : value === id);
  return html`<div class="row-wrap" role="group" aria-label=${label}>${options.map(([id, text]) => html`<button key=${id} class="chip" aria-pressed=${on(id) ? 'true' : 'false'} onClick=${() => onChange(multi ? (on(id) ? value.filter((x) => x !== id) : [...value, id]) : id)}>${text}</button>`)}</div>`;
}

function TagInput({ values, onChange, placeholder, max = 15, label }) {
  const [v, setV] = useState('');
  const add = () => {
    const word = v.trim();
    if (word && !values.some((x) => x.toLowerCase() === word.toLowerCase()) && values.length < max) onChange([...values, word.slice(0, 30)]);
    setV('');
  };
  return html`<div class="stack" style=${{ gap: '10px' }}>
    <div class="tags">${values.map((tag) => html`<span class="tag" key=${tag}>${tag}<button aria-label=${t('Remove {name}', { name: tag })} onClick=${() => onChange(values.filter((x) => x !== tag))}><${Icon} name="x" /></button></span>`)}</div>
    <input class="input" aria-label=${label} placeholder=${placeholder} value=${v} maxlength="30" onInput=${(e) => setV(e.target.value)} onKeyDown=${(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), add())} onBlur=${add} />
  </div>`;
}

function StyleDna() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/insights').then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const total = d.palette.reduce((n, p) => n + p.count, 0) || 1;
  return html`<section class="card section-card enter">
    <div class="spread" style=${{ alignItems: 'flex-start' }}><div class="stack" style=${{ gap: '6px' }}><h2 class="display h-m">${t('Your style DNA')}</h2><p class="muted small" style=${{ maxWidth: '60ch' }}>${d.signals >= 3 ? tn(d.signals, 'Learned from {n} reaction. The more you love and skip, the sharper it gets.', 'Learned from {n} reactions. The more you love and skip, the sharper it gets.') : t('Love or skip a few outfits and looks, and what we learn about your taste will appear here.')}</p></div>${d.signals ? html`<span class="badge">${t('{n}% confident', { n: d.confidence })}</span>` : null}</div>
    ${d.palette.length ? html`<div class="stack" style=${{ gap: '10px' }}><span class="label">${t('Your closet’s palette')}</span><div class="dna-bar" role="img" aria-label=${t('Closet palette: {colours}', { colours: d.palette.map((p) => t(p.name)).join(', ') })}>${d.palette.map((p) => html`<span key=${p.name} title=${t(p.name)} style=${{ background: p.hex, flexGrow: p.count / total * 100 }}></span>`)}</div><div class="small muted">${t('{n}% neutrals', { n: d.closet.neutralShare })}${d.closet.neverWorn ? ` · ${tn(d.closet.neverWorn, '{n} piece not worn yet', '{n} pieces not worn yet')}` : ''}</div></div>` : null}
    ${d.loves.length || d.avoids.length ? html`<div class="size-row">
      ${d.loves.length ? html`<div class="stack" style=${{ gap: '8px' }}><span class="label">${t('You tend to love')}</span><div class="row-wrap">${d.loves.map((x) => html`<span class="badge badge-ok" key=${x}>${t(x)}</span>`)}</div></div>` : null}
      ${d.avoids.length ? html`<div class="stack" style=${{ gap: '8px' }}><span class="label">${t('You tend to skip')}</span><div class="row-wrap">${d.avoids.map((x) => html`<span class="badge badge-clay" key=${x}>${t(x)}</span>`)}</div></div>` : null}
    </div>` : null}
    ${d.archetypes.length ? html`<div class="stack" style=${{ gap: '10px' }}><span class="label">${t('What your closet says')}</span>${d.archetypes.map((a) => html`<div key=${a.id} class="stack" style=${{ gap: '4px' }}><div class="spread small"><span>${t(a.label)}</span><span class="muted num">${a.share}%</span></div><div class="meter"><i style=${{ width: `${a.share}%` }}></i></div></div>`)}</div>` : null}
  </section>`;
}

function StyleSection({ profile }) {
  const [status, save] = useSaver();
  const s = profile.style;
  const [stores, setStores] = useState([]);
  useEffect(() => { api.get('/shop/retailers').then((d) => setStores(d.retailers)).catch(() => {}); }, []);
  const colorState = (name) => (s.likedColors.includes(name) ? 'like' : s.avoidedColors.includes(name) ? 'avoid' : '');
  const cycle = (name) => {
    const st = colorState(name);
    const liked = s.likedColors.filter((c) => c !== name);
    const avoided = s.avoidedColors.filter((c) => c !== name);
    if (st === '') save({ style: { likedColors: [...liked, name].slice(-8), avoidedColors: avoided } });
    else if (st === 'like') save({ style: { likedColors: liked, avoidedColors: [...avoided, name].slice(-8) } });
    else save({ style: { likedColors: liked, avoidedColors: avoided } });
  };
  const dept = profile.department;
  return html`<div class="stack-l">
    <${StyleDna} />
    <${Section} title=${t('Your style')} blurb=${t('Vote on each style. We use it to choose what to show you, and it keeps learning from every outfit you love or skip.')} status=${status}>
      <${ArchetypeGrid} value=${s.archetypes} onChange=${(archetypes) => save({ style: { archetypes, quizDone: true } })} />
    </${Section}>
    <${Section} title=${t('Colours')} blurb=${t('Tap once to love a colour, twice to avoid it, three times to clear it.')}>
      <div class="swatches">${PALETTE.map((p) => html`<button key=${p.name} class=${`swatch ${colorState(p.name) === 'avoid' ? 'avoid' : ''}`} style=${{ background: p.hex }} title=${`${cap(t(p.name))}${colorState(p.name) ? ` (${colorState(p.name) === 'like' ? t('love') : t('avoid')})` : ''}`} aria-label=${`${t(p.name)}: ${colorState(p.name) === 'like' ? t('love') : colorState(p.name) === 'avoid' ? t('avoid') : t('neutral')}`} aria-pressed=${colorState(p.name) ? 'true' : 'false'} onClick=${() => cycle(p.name)}></button>`)}</div>
      <div class="small muted">${s.likedColors.length ? `${t('Love: {colours}.', { colours: s.likedColors.map((c) => cap(t(c))).join(', ') })} ` : ''}${s.avoidedColors.length ? t('Avoid: {colours}.', { colours: s.avoidedColors.map((c) => cap(t(c))).join(', ') }) : s.likedColors.length ? '' : t('No preferences yet.')}</div>
      <div class="stack" style=${{ gap: '8px' }}><span class="label">${t('Patterns to avoid')}</span><${ToggleGroup} multi label=${t('Patterns to avoid')} options=${PATTERNS.filter((p) => p !== 'solid').map((p) => [p, t(cap(p))])} value=${s.avoidedPatterns} onChange=${(v) => save({ style: { avoidedPatterns: v } })} /></div>
    </${Section}>
    <${Section} title=${t('Never suggest')} blurb=${t('Anything here is ruled out completely, in every look and recommendation.')}>
      <${ToggleGroup} multi label=${t('Never suggest')} options=${Object.entries(NEVER_TAGS).map(([id, x]) => [id, t(x)])} value=${s.never} onChange=${(v) => save({ style: { never: v } })} />
    </${Section}>
    <${Section} title=${t('Brands and stores')} blurb=${t('Pick stores you like to shop at (or none, and we’ll choose). Avoided brands never appear.')}>
      <div class="store-grid">${stores.filter((r) => dept === 'unisex' || r.departments.includes(dept)).map((r) => html`<button key=${r.id} class="opt" aria-pressed=${s.stores.includes(r.id) ? 'true' : 'false'} onClick=${() => save({ style: { stores: s.stores.includes(r.id) ? s.stores.filter((x) => x !== r.id) : [...s.stores, r.id] } })}><b>${r.name}</b><span>${{ value: '$', mid: '$$', premium: '$$$' }[r.tier]}</span></button>`)}</div>
      <div class="spread"><div><div class="label">${t('Mix brands in one look')}</div><div class="hint">${t('Off keeps each look to a single store')}</div></div><${Switch} label=${t('Mix brands')} checked=${s.mixStores} onChange=${(v) => save({ style: { mixStores: v } })} /></div>
      <div class="size-row">
        <div class="field"><span class="label">${t('Brands you love')}</span><${TagInput} label=${t('Brands you love')} values=${s.brands.love} placeholder=${t('Type a brand, press Enter')} onChange=${(v) => save({ style: { brands: { love: v } } })} /></div>
        <div class="field"><span class="label">${t('Brands to avoid')}</span><${TagInput} label=${t('Brands to avoid')} values=${s.brands.avoid} placeholder=${t('Type a brand, press Enter')} onChange=${(v) => save({ style: { brands: { avoid: v } } })} /></div>
      </div>
    </${Section}>
    <${Section} title=${t('A note for your stylist')} blurb=${t('Anything that helps: fabrics you can’t stand, an event coming up, what you wish you wore more.')}>
      <${NoteField} value=${s.notes} onSave=${(notes) => save({ style: { notes } })} />
    </${Section}>
  </div>`;
}

function NoteField({ value, onSave }) {
  const [v, setV] = useState(value);
  return html`<div class="field"><textarea class="textarea" aria-label=${t('Note for your stylist')} maxlength="600" placeholder=${t('e.g. Wool makes me itch. I have a wedding in November.')} value=${v} onInput=${(e) => setV(e.target.value)} onBlur=${() => v !== value && onSave(v)}></textarea><span class="hint">${v.length}/600</span></div>`;
}

function AboutSection({ profile }) {
  const [status, save] = useSaver();
  const [loc, setLoc] = useState(false);
  const days = [0, 1, 2, 3, 4, 5, 6].map(weekdayShort);
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : '');
  return html`<${Section} title=${t('About you')} blurb=${t('Used to pick the right weather, the right stores and the right occasions.')} status=${status}>
    <div class="field"><span class="label">${t('I shop for')}</span><${ToggleGroup} label=${t('Department')} options=${[['women', t('Womenswear')], ['men', t('Menswear')], ['unisex', t('Both')]]} value=${profile.department} onChange=${(v) => save({ department: v })} /></div>
    <div class="field"><span class="label">${t('Age range')} <span class="faint">${t('(optional)')}</span></span><${ToggleGroup} label=${t('Age range')} options=${AGE_RANGES.map((a) => [a, a])} value=${profile.ageRange} onChange=${(v) => save({ ageRange: v })} /></div>
    <div class="size-row">
      <div class="field"><span class="label">${t('Location')}</span><button class="btn btn-outline" style=${{ justifyContent: 'space-between' }} onClick=${() => setLoc(true)}><span class="row"><${Icon} name="pin" />${profile.location?.name || t('Set location')}</span><${Icon} name="right" /></button></div>
      <div class="field"><span class="label">${t('Language')}</span><${LanguagePicker} /></div>
      <div class="field"><label for="cur">${t('Currency')}</label><select id="cur" class="select" value=${profile.currency || 'USD'} onChange=${(e) => save({ currency: e.target.value })}>${CURRENCIES.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}</select></div>
      <div class="field"><span class="label">${t('Units')}</span><${ToggleGroup} label=${t('Units')} options=${[['imperial', '°F · mph'], ['metric', '°C · km/h']]} value=${profile.units} onChange=${(v) => save({ units: v })} /></div>
      <div class="field"><label for="h">${t('Height (cm)')} <span class="faint">${t('(optional)')}</span></label><input id="h" class="input" inputmode="numeric" value=${height} placeholder="170" onInput=${(e) => setHeight(e.target.value.replace(/\D/g, '').slice(0, 3))} onBlur=${() => { const n = Number(height); if (!height) save({ heightCm: null }); else if (n >= 90 && n <= 230) save({ heightCm: n }); else toast(t('Enter a height between 90 and 230 cm.'), { kind: 'err' }); }} /></div>
    </div>
    <div class="field"><span class="label">${t('Days I dress for work')}</span><div class="row-wrap">${days.map((d, i) => html`<button key=${d} class="chip" aria-pressed=${profile.workDays.includes(i) ? 'true' : 'false'} onClick=${() => save({ workDays: profile.workDays.includes(i) ? profile.workDays.filter((x) => x !== i) : [...profile.workDays, i].sort() })}>${d}</button>`)}</div></div>
    ${loc ? html`<${Sheet} title=${t('Your location')} onClose=${() => setLoc(false)}><${LocationPicker} onPick=${(l) => { save({ location: l }); setLoc(false); }} /></${Sheet}>` : null}
  </${Section}>`;
}

const SIZE_HINTS = {
  top: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  bottom: ['26', '28', '30', '32', '34', '36', '30x30', '32x32', '34x32'],
  dress: ['0', '2', '4', '6', '8', '10', '12', '14', 'S', 'M', 'L'],
  shoe: ['6', '7', '8', '9', '10', '11', '12', '13'],
  outerwear: ['S', 'M', 'L', 'XL']
};

function SizesFitSection({ profile }) {
  const [status, save] = useSaver();
  const [sizes, setSizes] = useState(profile.sizes || {});
  const areas = BODY_AREAS;
  const stateOf = (a) => (profile.bodyAreas.show.includes(a) ? 'show' : profile.bodyAreas.cover.includes(a) ? 'cover' : 'none');
  const setArea = (a, st) => save({ bodyAreas: { show: st === 'show' ? [...profile.bodyAreas.show.filter((x) => x !== a), a] : profile.bodyAreas.show.filter((x) => x !== a), cover: st === 'cover' ? [...profile.bodyAreas.cover.filter((x) => x !== a), a] : profile.bodyAreas.cover.filter((x) => x !== a) } });
  const labels = { top: L('Tops'), bottom: L('Bottoms (waist or WxL)'), dress: L('Dresses'), shoe: L('Shoes (US)'), outerwear: L('Outerwear') };
  return html`<div class="stack-l">
    <${Section} title=${t('Sizes')} blurb=${t('So you can tell at a glance whether a suggestion comes in your size.')} status=${status}>
      <div class="size-row">${Object.keys(SIZE_HINTS).map((k) => html`<div class="field" key=${k}><label for=${`sz-${k}`}>${t(labels[k])}</label><input id=${`sz-${k}`} class="input" maxlength="12" list=${`dl-${k}`} value=${sizes[k] || ''} onInput=${(e) => setSizes((p) => ({ ...p, [k]: e.target.value }))} onBlur=${() => (sizes[k] || '') !== (profile.sizes?.[k] || '') && save({ sizes: { [k]: sizes[k] || '' } })} /><datalist id=${`dl-${k}`}>${SIZE_HINTS[k].map((o) => html`<option key=${o} value=${o}></option>`)}</datalist></div>`)}</div>
    </${Section}>
    <${Section} title=${t('How you like things to fit')}>
      <div class="field"><span class="label">${t('Tops')}</span><${ToggleGroup} label=${t('Top fit')} options=${FIT_TOPS.map((f) => [f, t(cap(f))])} value=${profile.fit.tops} onChange=${(v) => save({ fit: { tops: v } })} /></div>
      <div class="field"><span class="label">${t('Bottoms')}</span><${ToggleGroup} label=${t('Bottom fit')} options=${FIT_BOTTOMS.map((f) => [f, t(cap(f))])} value=${profile.fit.bottoms} onChange=${(v) => save({ fit: { bottoms: v } })} /></div>
      <div class="stack" style=${{ gap: '12px' }}>
        <span class="label">${t('Show off or cover up?')}</span>
        ${Object.entries(areas).map(([a, areaName]) => html`<div class="spread" key=${a} style=${{ flexWrap: 'wrap' }}><span>${t(areaName)}</span><div class="segmented" role="group" aria-label=${t(areaName)}>${[['show', t('Show off')], ['none', t('No preference')], ['cover', t('Cover up')]].map(([id, text]) => html`<button key=${id} aria-pressed=${stateOf(a) === id ? 'true' : 'false'} onClick=${() => setArea(a, id)}>${text}</button>`)}</div></div>`)}
      </div>
    </${Section}>
  </div>`;
}

function LifestyleBudget({ profile }) {
  const [status, save] = useSaver();
  const labels = { top: L('Tops'), bottom: L('Bottoms'), dress: L('Dresses'), outerwear: L('Outerwear'), shoes: L('Shoes') };
  const max = { top: 250, bottom: 350, dress: 500, outerwear: 800, shoes: 400 };
  return html`<div class="stack-l">
    <${Section} title=${t('What you dress for')} blurb=${t('We build looks for each of these, and check your closet has what they need.')} status=${status}>
      <${ToggleGroup} multi label=${t('Occasions')} options=${Object.entries(SHOP_OCCASIONS).map(([id, x]) => [id, t(x)])} value=${profile.lifestyle.occasions} onChange=${(v) => save({ lifestyle: { occasions: v } })} />
      <div class="field"><span class="label">${t('Your workplace dress code')}</span><div class="opt-grid">${Object.entries(DRESS_CODES).map(([id, text]) => html`<button key=${id} class="opt" aria-pressed=${profile.lifestyle.dressCode === id ? 'true' : 'false'} onClick=${() => save({ lifestyle: { dressCode: id } })}><b>${t(text)}</b></button>`)}</div></div>
    </${Section}>
    <${Section} title=${t('Budget')} blurb=${t('The most you’d happily spend on a single piece. We favour stores and items that fit.')} status=${status}>
      <div class="opt-grid">${Object.entries(BUDGET_TIERS).map(([id, tier]) => html`<button key=${id} class="opt" aria-pressed=${profile.budget.tier === id ? 'true' : 'false'} onClick=${() => save({ budget: { tier: id } })}><b>${t(tier.label)}</b><span>${t(tier.hint)}</span></button>`)}</div>
      <div class="stack">${BUDGET_CATEGORIES.map((c) => html`<div class="field" key=${c}><div class="spread"><label for=${`b-${c}`}>${t(labels[c])}</label><span class="small num">${t('{amount} max', { amount: `$${profile.budget[c]}` })}</span></div><input id=${`b-${c}`} class="range" type="range" min="10" max=${max[c]} step="5" value=${Math.min(max[c], profile.budget[c])} onChange=${(e) => save({ budget: { [c]: Number(e.target.value) } })} /></div>`)}</div>
    </${Section}>
  </div>`;
}

function AccountSection({ user, entitlements, capabilities }) {
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState('');
  const pro = entitlements?.plan === 'pro';

  const saveName = async () => {
    if (name.trim() === user.name) return;
    try { const r = await api.patch('/account', { name: name.trim() }); set({ user: { ...state.user, ...r.user } }); toast(t('Name updated')); } catch (e) { fail(e); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    setBusy('pw');
    try { await api.post('/account/password', pw); setPw({ current: '', next: '' }); toast(t('Password changed. Other devices were signed out.')); } catch (err) { fail(err); } finally { setBusy(''); }
  };
  const portal = async () => {
    setBusy('portal');
    try { const { url } = await api.post('/billing/portal', {}); location.href = url; } catch (e) { fail(e); setBusy(''); }
  };
  const exportData = async () => {
    try {
      const res = await fetch('/api/account/export', { credentials: 'same-origin', headers: { 'X-Requested-With': 'modaward' } });
      if (!res.ok) throw new Error(t('Something went wrong. Please try again.'));
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'modaward-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) { fail(e); }
  };
  const del = async () => {
    const password = prompt(t('This permanently deletes your account, closet and photos. Enter your password to confirm.'));
    if (!password) return;
    try { await api.del('/account', { password }); await forgetThisDevice(); set({ user: null, profile: null, garments: null }); toast(t('Your account has been deleted.')); navigate('/login'); } catch (e) { fail(e); }
  };

  return html`<div class="stack-l">
    <${Section} title=${t('Your plan')}>
      <div class="spread" style=${{ flexWrap: 'wrap' }}>
        <div class="stack" style=${{ gap: '4px' }}><div class="row">${pro ? html`<${ProBadge} />` : html`<span class="badge">${t('Free')}</span>`}<b>${pro ? t('ModaWard Pro') : t('ModaWard Free')}</b></div><p class="muted small">${pro ? (user.planRenewsAt ? t('Renews {date}', { date: new Date(user.planRenewsAt * 1000).toLocaleDateString(getLocale()) }) : t('Thank you for supporting ModaWard.')) : t('{pieces} pieces · 3-day planning · {looks} looks at a time', { pieces: entitlements?.closetLimit, looks: entitlements?.shopLooks })}</p></div>
        ${pro ? (capabilities.billing ? html`<button class="btn btn-outline" onClick=${portal} disabled=${busy === 'portal'}>${busy === 'portal' ? html`<${Spinner} />` : null}${t('Manage billing')}</button>` : null) : html`<button class="btn btn-primary" onClick=${() => navigate('/pro')}><${Icon} name="crown" />${t('See Pro')}</button>`}
      </div>
    </${Section}>
    <${Section} title=${t('Account')}>
      <div class="size-row">
        <div class="field"><label for="acc-name">${t('Name')}</label><input id="acc-name" class="input" maxlength="60" value=${name} onInput=${(e) => setName(e.target.value)} onBlur=${saveName} /></div>
        <div class="field"><label for="acc-email">${t('Email')}</label><input id="acc-email" class="input" value=${user.email} readonly /></div>
      </div>
      <form class="stack" onSubmit=${changePw}>
        <span class="label">${t('Change password')}</span>
        <div class="size-row">
          <input class="input" type="password" autocomplete="current-password" placeholder=${t('Current password')} aria-label=${t('Current password')} value=${pw.current} onInput=${(e) => setPw({ ...pw, current: e.target.value })} required />
          <input class="input" type="password" autocomplete="new-password" placeholder=${t('New password (10+ characters)')} aria-label=${t('New password')} minlength="10" value=${pw.next} onInput=${(e) => setPw({ ...pw, next: e.target.value })} required />
        </div>
        <div><button class="btn btn-outline" disabled=${busy === 'pw'}>${busy === 'pw' ? html`<${Spinner} />` : null}${t('Update password')}</button></div>
      </form>
    </${Section}>
    <${Section} title=${t('Your data')} blurb=${t('You own your closet and your data. Download everything, or delete it for good.')}>
      <div class="row-wrap"><button class="btn btn-outline" onClick=${exportData}><${Icon} name="download" />${t('Download my data')}</button><button class="btn btn-danger" onClick=${del}><${Icon} name="trash" />${t('Delete account')}</button></div>
    </${Section}>
    ${state.app ? html`<p class="tiny faint">ModaWard ${state.app.version} · ${state.app.build}</p>` : null}
    <button class="btn btn-ghost" style=${{ justifySelf: 'start' }} onClick=${logout}><${Icon} name="logout" />${t('Sign out')}</button>
  </div>`;
}

const SECTIONS = [
  ['style', L('Style & colours'), 'sparkle', (c) => c.next.every((n) => n.key !== 'quiz')],
  ['about', L('About you'), 'user', (c) => c.next.every((n) => n.key !== 'location')],
  ['fit', L('Sizes & fit'), 'sliders', (c) => c.next.every((n) => n.key !== 'sizes')],
  ['life', L('Lifestyle & budget'), 'bag', (c) => c.next.every((n) => n.key !== 'lifestyle')],
  ['reminders', L('Reminders'), 'bell', () => true],
  ['account', L('Account & plan'), 'settings', () => true]
];

export function ProfileView() {
  const { profile, user, entitlements, capabilities } = useStore();
  // returning from Stripe: the webhook may land a moment after the redirect, so poll briefly
  useEffect(() => {
    if (!new URLSearchParams(location.search).get('upgraded')) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        await refreshMe();
        if (state.entitlements?.plan === 'pro') {
          clearInterval(timer);
          toast(t('Welcome to Pro. Everything is unlocked.'));
          navigate('/style?section=account', { replace: true });
        }
      } catch { /* keep trying */ }
      if (tries >= 12) clearInterval(timer);
    }, 1500);
    return () => clearInterval(timer);
  }, []);
  const search = useSearch();
  const [section, setSection] = useState(() => new URLSearchParams(location.search).get('section') || 'style');
  useEffect(() => {
    const wanted = new URLSearchParams(search).get('section');
    if (wanted) setSection(wanted);
  }, [search]);
  const c = profileCompleteness();
  const nextItem = c.next[0];
  const jump = (id) => { setSection(id); window.scrollTo({ top: 0 }); };
  return html`<div class="stack-l">
    <header class="card card-pad row enter" style=${{ gap: '20px', flexWrap: 'wrap' }}>
      <div class="ring" style=${{ '--p': c.percent }}><b>${c.percent}</b></div>
      <div class="grow stack" style=${{ gap: '4px' }}>
        <div class="row"><h1 class="display h-m">${user.name || user.email.split('@')[0]}</h1>${entitlements?.plan === 'pro' ? html`<${ProBadge} />` : null}</div>
        <p class="muted small"> ${c.percent >= 100 ? t('Your style profile is complete. Your picks are as sharp as they get.') : html`${t('Your style profile is {n}% complete.', { n: c.percent })} ${nextItem ? html`${t('Next:')} <button class="small" style=${{ textDecoration: 'underline', textUnderlineOffset: '3px', fontWeight: 550 }} onClick=${() => jump({ quiz: 'style', location: 'about', sizes: 'fit', fit: 'fit', lifestyle: 'life', colors: 'style', budget: 'life', bodyAreas: 'fit', never: 'style', brands: 'style', stores: 'style', notes: 'style' }[nextItem.key])}>${t(nextItem.label)}</button>` : null}`}</p>
      </div>
    </header>
    <div class="profile-grid">
      <nav class="profile-nav" aria-label=${t('Profile sections')}>
        ${SECTIONS.map(([id, label, icon, done]) => html`<button key=${id} class="pn" aria-current=${section === id ? 'true' : 'false'} onClick=${() => jump(id)}><${Icon} name=${icon} size="18" />${t(label)}${id !== 'account' && id !== 'reminders' ? html`<span class=${`done ${done(c) ? 'y' : ''}`} aria-hidden="true"></span>` : null}</button>`)}
      </nav>
      <div key=${section}>
        ${section === 'style' ? html`<${StyleSection} profile=${profile} />` : null}
        ${section === 'about' ? html`<${AboutSection} profile=${profile} />` : null}
        ${section === 'fit' ? html`<${SizesFitSection} profile=${profile} />` : null}
        ${section === 'life' ? html`<${LifestyleBudget} profile=${profile} />` : null}
        ${section === 'reminders' ? html`<${RemindersSection} />` : null}
        ${section === 'account' ? html`<${AccountSection} user=${user} entitlements=${entitlements} capabilities=${capabilities} />` : null}
      </div>
    </div>
  </div>`;
}
