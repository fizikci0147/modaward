import { html, useState, useEffect, useMemo } from '/js/ui.js';
import { t, tn } from '/js/i18n.js';
import { api } from '/js/api.js';
import { state, toast, fail, updateProfile } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { Spinner } from '/js/components/common.js';

const BAND = { value: '$', mid: '$$', premium: '$$$' };
const PAGE = 24;

/**
 * Choose where you shop: search the whole store database, narrow it to a region, and add a store that is not listed.
 * Stores picked here are the ones the Shop builds looks from; stores you add get links of their own.
 */
export function StorePicker({ profile, save }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState(null); // null until the server's guess arrives; '*' shows every region
  const [shown, setShown] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', search: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/shop/stores').then((d) => (setData(d), setRegion(d.region))).catch(() => setData({ stores: [], custom: [], regions: [], region: 'US' }));
  }, []);

  const chosen = profile.style.stores;
  const dept = profile.department;
  const toggle = (id) => save({ style: { stores: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] } });

  const results = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.stores
      .filter((r) => (dept === 'unisex' || r.departments.includes(dept)) && (region === '*' || r.regions.includes('*') || r.regions.includes(region)) && (!q || r.name.toLowerCase().includes(q) || r.id.includes(q)))
      .sort((a, b) => Number(b.core.includes(region)) - Number(a.core.includes(region)) || a.name.localeCompare(b.name));
  }, [data, query, region, dept]);

  const custom = data?.custom || [];
  const byId = useMemo(() => new Map([...(data?.stores || []), ...custom].map((s) => [s.id, s])), [data]);
  const picked = chosen.map((id) => byId.get(id)).filter(Boolean);

  const changeRegion = (code) => {
    setRegion(code);
    setShown(PAGE);
    if (code !== '*') updateProfile({ shopRegion: code }, { quiet: true }).catch(() => {});
  };

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/shop/stores', { name: form.name, url: form.url, ...(form.search.trim() ? { search: form.search.trim() } : {}) });
      setData((d) => ({ ...d, custom: [...d.custom, res.store] }));
      // the server chose it too; saving the whole list from here keeps any picks still waiting to be saved
      updateProfile({ style: { stores: [...new Set([...state.profile.style.stores, res.store.id])] } }, { immediate: true, quiet: true }).catch(() => {});
      setForm({ name: '', url: '', search: '' });
      setAdding(false);
      toast(t('{name} added. We’ll link to it in your looks.', { name: res.store.name }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s) => {
    if (!confirm(t('Remove “{name}” from your stores?', { name: s.name }))) return;
    try {
      await api.del(`/shop/stores/${s.id}`);
      setData((d) => ({ ...d, custom: d.custom.filter((c) => c.id !== s.id) }));
      updateProfile({ style: { stores: state.profile.style.stores.filter((id) => id !== s.id) } }, { immediate: true, quiet: true }).catch(() => {});
    } catch (err) {
      fail(err);
    }
  };

  if (!data) return html`<p class="small muted row" style=${{ gap: '8px' }}><${Spinner} />${t('Loading stores…')}</p>`;
  const visible = results.slice(0, shown);

  return html`<div class="stack store-picker">
    ${picked.length
      ? html`<div class="stack" style=${{ gap: '8px' }}><span class="label">${t('Your stores')}</span><div class="row-wrap" role="group" aria-label=${t('Your stores')}>${picked.map((s) => html`<button key=${s.id} class="chip chip-s" aria-label=${t('Remove {name}', { name: s.name })} onClick=${() => toggle(s.id)}>${s.name}<${Icon} name="x" size="12" /></button>`)}</div></div>`
      : null}

    <div class="store-filters">
      <div class="field"><label for="store-region">${t('Where do you shop?')}</label>
        <select id="store-region" class="select" value=${region} onChange=${(e) => changeRegion(e.target.value)}>
          ${data.regions.map((r) => html`<option key=${r.code} value=${r.code}>${t(r.name)}</option>`)}
          <option value="*">${t('All regions')}</option>
        </select></div>
      <div class="field"><label for="store-search">${t('Search stores')}</label>
        <input id="store-search" class="input" type="search" autocomplete="off" placeholder=${t('Type a store name')} value=${query} onInput=${(e) => (setQuery(e.target.value), setShown(PAGE))} /></div>
    </div>

    ${custom.length
      ? html`<div class="stack" style=${{ gap: '8px' }}><span class="label">${t('Stores you added')}</span><div class="store-grid">${custom.map((s) => html`<div key=${s.id} class="store-own"><button class="opt" aria-pressed=${chosen.includes(s.id) ? 'true' : 'false'} onClick=${() => toggle(s.id)}><b>${s.name}</b><span>${s.domain}</span></button><button class="icon-btn store-del" aria-label=${t('Remove “{name}” from your stores?', { name: s.name })} onClick=${() => remove(s)}><${Icon} name="trash" size="16" /></button></div>`)}</div></div>`
      : null}

    <div class="store-grid" role="group" aria-label=${t('Stores')}>${visible.map((r) => html`<button key=${r.id} class="opt" aria-pressed=${chosen.includes(r.id) ? 'true' : 'false'} onClick=${() => toggle(r.id)}><b>${r.name}</b><span>${BAND[r.tier]}</span></button>`)}</div>
    ${results.length
      ? html`<div class="spread"><span class="small muted" aria-live="polite">${t('Showing {n} of {total} stores', { n: visible.length, total: results.length })}</span>${results.length > shown ? html`<button class="btn btn-outline btn-s" onClick=${() => setShown(shown + PAGE * 2)}>${t('Show more')}</button>` : null}</div>`
      : html`<p class="hint">${t('No store matches that. Try another spelling, or add it below.')}</p>`}

    ${adding
      ? html`<form class="stack callout" onSubmit=${add}>
          <div class="field"><label for="store-name">${t('Store name')}</label><input id="store-name" class="input" maxlength="40" required value=${form.name} onInput=${(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div class="field"><label for="store-url">${t('Website')}</label><input id="store-url" class="input" inputmode="url" autocapitalize="off" autocomplete="off" placeholder="store.com" required value=${form.url} onInput=${(e) => setForm({ ...form, url: e.target.value })} /></div>
          <details><summary class="small">${t('Search link (optional)')}</summary>
            <div class="field"><input id="store-searchlink" class="input" inputmode="url" autocapitalize="off" aria-label=${t('Search link (optional)')} placeholder="https://store.com/search?q={q}" value=${form.search} onInput=${(e) => setForm({ ...form, search: e.target.value })} /><span class="hint">${t('Paste a search page from the store and put {q} where the search words go. Without it we search the store’s website for each piece.')}</span></div></details>
          <div class="row-wrap"><button class="btn btn-primary btn-s" type="submit" disabled=${busy}>${busy ? html`<${Spinner} />` : null}${t('Add store')}</button><button class="btn btn-ghost btn-s" type="button" onClick=${() => setAdding(false)}>${t('Cancel')}</button></div>
        </form>`
      : html`<div><button class="btn btn-outline btn-s" onClick=${() => setAdding(true)}><${Icon} name="plus" size="14" />${t('Add a store that is not listed')}</button><p class="hint" style=${{ marginTop: '6px' }}>${tn(custom.length, 'You have added {n} store.', 'You have added {n} stores.')}</p></div>`}
  </div>`;
}
