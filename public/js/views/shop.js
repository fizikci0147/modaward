import { html, useState, useEffect, useCallback } from '/js/ui.js';
import { t, tn } from '/js/i18n.js';
import { L } from '/shared/i18n.js';
import { api } from '/js/api.js';
import { useStore, fail, openUpgrade, toast } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { LookCard, GapCard } from '/js/components/look.js';
import { Empty, Spinner } from '/js/components/common.js';
import { NoLocation } from '/js/views/today.js';
import { OCCASIONS } from '/shared/taxonomy.js';
import { Link } from '/js/router.js';

const KINDS = [['both', L('All looks')], ['new', L('New outfits')], ['owned', L('With my closet')]];

function useSession(key, initial) {
  const [v, setV] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key)) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(v));
    } catch { /* private mode */ }
  }, [v]);
  return [v, setV];
}

function Disclosure() {
  return html`<p class="footnote">${t('ModaWard may earn a commission when you buy through links on this page, at no extra cost to you. That never changes what we recommend. Prices and availability are set by each retailer. Pieces marked “opens a search” take you to that store’s results for the item.')}</p>`;
}

function ForYou({ profile, entitlements }) {
  const [kind, setKind] = useSession('mw.shop.kind', 'both');
  const [storeMode, setStoreMode] = useSession('mw.shop.store', profile.style?.mixStores === false ? 'single' : 'mix');
  const [occ, setOcc] = useSession('mw.shop.occ', []);
  const [seed, setSeed] = useState(1);
  const [s, setS] = useState({ loading: true, data: null, error: null });
  const [hidden, setHidden] = useState([]);
  const [savedMap, setSavedMap] = useState({});

  useEffect(() => {
    const ctl = new AbortController();
    setS((p) => ({ ...p, loading: true, error: null }));
    api.post('/shop/looks', { kind, storeMode, seed: String(seed), limit: 24, ...(occ.length ? { occasions: occ } : {}) }, { signal: ctl.signal })
      .then((data) => (setHidden([]), setS({ loading: false, data, error: null })))
      .catch((error) => error.name !== 'AbortError' && setS({ loading: false, data: null, error }));
    return () => ctl.abort();
  }, [kind, storeMode, occ.join(','), seed]);

  const { data, loading, error } = s;
  const looks = (data?.looks || []).filter((l) => !hidden.includes(l.id));
  const toggleOcc = (id) => setOcc((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return html`<div class="stack-l">
    <div class="stack enter enter-2">
      <div class="row-wrap" style=${{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div class="segmented" role="group" aria-label=${t('Kind of look')}>${KINDS.map(([id, label]) => html`<button key=${id} aria-pressed=${kind === id ? 'true' : 'false'} onClick=${() => setKind(id)}>${t(label)}</button>`)}</div>
        <div class="segmented" role="group" aria-label=${t('Where to shop')}>
          <button aria-pressed=${storeMode === 'mix' ? 'true' : 'false'} onClick=${() => setStoreMode('mix')}>${t('Mix brands')}</button>
          <button aria-pressed=${storeMode === 'single' ? 'true' : 'false'} onClick=${() => setStoreMode('single')}>${t('One store')}</button>
        </div>
      </div>
      <div class="chips-scroll" role="group" aria-label=${t('Occasion')}>
        <button class="chip" aria-pressed=${occ.length === 0 ? 'true' : 'false'} onClick=${() => setOcc([])}>${t('For my life')}</button>
        ${Object.entries(OCCASIONS).map(([id, o]) => html`<button key=${id} class="chip" aria-pressed=${occ.includes(id) ? 'true' : 'false'} onClick=${() => toggleOcc(id)}>${t(o.label)}</button>`)}
      </div>
    </div>

    ${data?.reference ? html`<p class="small muted enter">${data.reference.wetDays ? tn(data.reference.wetDays, 'Tuned to the week ahead: {range}, with {n} wet day.', 'Tuned to the week ahead: {range}, with {n} wet days.', { range: data.reference.range }) : t('Tuned to the week ahead: {range}.', { range: data.reference.range })}${data.usingProducts ? '' : ` ${t('Links open each store’s search for the piece.')}`}</p>` : null}
    ${data?.stylistNote ? html`<p class="display h-s enter">${data.stylistNote}</p>` : null}

    ${loading && !data ? html`<div class="looks">${[1, 2, 3, 4].map((i) => html`<div key=${i} class="skel" style=${{ height: '560px', borderRadius: '20px' }}></div>`)}</div>` : null}
    ${error ? (error.code === 'location_required' ? html`<${NoLocation} />` : html`<div class="card card-pad stack center"><p>${error.message}</p><div><button class="btn btn-outline" onClick=${() => setSeed((x) => x + 1)}>${t('Try again')}</button></div></div>`) : null}

    ${data && !looks.length ? html`<${Empty} title=${t('No looks right now')} text=${t('Your filters are quite specific. Try a different occasion or switch to all looks.')} />` : null}
    ${looks.length
      ? html`<div class="looks" style=${{ opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
          ${looks.map((l) => html`<${LookCard} key=${l.id} look=${l} saved=${savedMap[l.id]} onHide=${(x) => setHidden((h) => [...h, x.id])} onSaved=${(x, id) => setSavedMap((m) => ({ ...m, [x.id]: id }))} onUnsave=${async (x, id) => { try { await api.del(`/shop/saved/${id}`); setSavedMap((m) => { const n = { ...m }; delete n[x.id]; return n; }); toast(t('Removed from your list')); } catch (e) { fail(e); } }} />`)}
          ${data.locked > 0
            ? html`<div class="card locked-card"><${Icon} name="lock" size="28" /><h3 class="display h-m">${t('{n}+ more looks in Pro', { n: data.locked })}</h3><p class="muted" style=${{ maxWidth: '36ch' }}>${t('The full feed mixes more brands, more occasions and gets sharper as you tell us what you love.')}</p><button class="btn btn-primary" onClick=${() => openUpgrade('pro')}>${t('Unlock all looks')}</button></div>`
            : null}
        </div>`
      : null}

    ${looks.length ? html`<div class="center"><button class="btn btn-outline" onClick=${() => setSeed((x) => x + 1)} disabled=${loading}>${loading ? html`<${Spinner} />` : html`<${Icon} name="refresh" />`}${t('Show me different looks')}</button></div>` : null}
    <${Disclosure} />
  </div>`;
}

function Gaps() {
  const [s, setS] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    api.post('/shop/gaps', {}).then((data) => setS({ loading: false, data, error: null })).catch((error) => setS({ loading: false, data: null, error }));
  }, []);
  if (s.loading) return html`<div class="stack">${[1, 2].map((i) => html`<div key=${i} class="skel" style=${{ height: '240px', borderRadius: '20px' }}></div>`)}</div>`;
  if (s.error) return html`<div class="card card-pad center">${s.error.message}</div>`;
  const gaps = s.data.gaps;
  if (!gaps.length) return html`<${Empty} title=${t('Your closet is well covered')} text=${t('Nothing urgent is missing for the week ahead. Check back when the forecast changes.')} />`;
  return html`<div class="stack-l"><p class="muted">${t('Based on your closet, the forecast and what you dress for.')}</p>${gaps.map((g) => html`<${GapCard} key=${g.id} gap=${g} />`)}<${Disclosure} /></div>`;
}

function Saved() {
  const [s, setS] = useState({ loading: true, saved: [] });
  useEffect(() => {
    api.get('/shop/saved').then((d) => setS({ loading: false, saved: d.saved })).catch((e) => (fail(e), setS({ loading: false, saved: [] })));
  }, []);
  if (s.loading) return html`<div class="skel" style=${{ height: '300px' }}></div>`;
  if (!s.saved.length) return html`<${Empty} title=${t('Nothing saved yet')} text=${t('Tap Save on any look and it will wait for you here.')} />`;
  return html`<div class="stack-l"><div class="looks">${s.saved.map((l) => html`<${LookCard} key=${l.id} look=${l} readOnly onUnsave=${async () => { try { await api.del(`/shop/saved/${l.id}`); setS((p) => ({ ...p, saved: p.saved.filter((x) => x.id !== l.id) })); toast(t('Removed')); } catch (e) { fail(e); } }} />`)}</div><${Disclosure} /></div>`;
}

export function ShopView() {
  const { profile, entitlements } = useStore();
  const [tab, setTab] = useSession('mw.shop.tab', 'for-you');
  if (!profile?.location) return html`<${NoLocation} />`;
  return html`<div class="stack-l">
    <header class="stack enter" style=${{ gap: '8px' }}>
      <h1 class="display h-xl">${tab === 'gaps' ? t('What’s missing') : tab === 'saved' ? t('Saved looks') : t('Looks for you')}</h1>
      <p class="muted" style=${{ maxWidth: '58ch' }}>${t('Complete outfits from the stores you like, chosen for your style, your closet and the weather ahead. The more you love and skip, the sharper they get.')}</p>
    </header>
    ${!profile.style?.quizDone ? html`<div class="upsell enter"><div class="grow"><b>${t('Take the 2 minute style quiz')}</b><p>${t('Tell us what you love and these picks get a lot more you.')}</p></div><${Link} href="/style" class="btn btn-s">${t('Start')}</${Link}></div>` : null}
    <div class="chips-scroll enter">
      ${[['for-you', t('For you')], ['gaps', t('Closet gaps')], ['saved', t('Saved')]].map(([id, label]) => html`<button key=${id} class="chip" aria-pressed=${tab === id ? 'true' : 'false'} onClick=${() => setTab(id)}>${label}</button>`)}
    </div>
    ${tab === 'for-you' ? html`<${ForYou} profile=${profile} entitlements=${entitlements} />` : tab === 'gaps' ? html`<${Gaps} />` : html`<${Saved} />`}
  </div>`;
}
