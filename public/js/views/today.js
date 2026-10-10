import { html, useState, useEffect, useRef } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { api } from '/js/api.js';
import { useStore, loadCloset, updateProfile, toast, fail, state, openUpgrade } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { WeatherHero, Tips } from '/js/components/weather.js';
import { OutfitCard } from '/js/components/outfit.js';
import { LocationPicker, Empty, Spinner } from '/js/components/common.js';
import { GarmentArt } from '/js/components/art.js';
import { OCCASIONS } from '/shared/taxonomy.js';
import { greeting } from '/js/format.js';
import { navigate, useQuery } from '/js/router.js';
import { shareOutfit } from '/js/share.js';

const occasionOptions = () => Object.entries(OCCASIONS).map(([id, o]) => ({ id, label: t(o.label) }));

/** Loads (and reloads) outfits for one day/occasion. */
export function useOutfits(date, occasion, seed, excludeIds = [], featureId = null) {
  const [s, setS] = useState({ loading: true, error: null, data: null });
  useEffect(() => {
    const ctl = new AbortController();
    setS((p) => ({ ...p, loading: true, error: null }));
    api.post('/outfits/recommend', { date, ...(occasion ? { occasion } : {}), seed: String(seed), count: 3, ...(excludeIds.length ? { excludeIds } : {}), ...(featureId ? { featureId } : {}) }, { signal: ctl.signal })
      .then((data) => setS({ loading: false, error: null, data }))
      .catch((error) => error.name !== 'AbortError' && setS({ loading: false, error, data: null }));
    return () => ctl.abort();
  }, [date, occasion, seed, excludeIds.join(','), featureId]);
  return [s, setS];
}

function Skeleton() {
  return html`<div class="stack-l"><div class="skel" style=${{ height: '250px', borderRadius: '28px' }}></div><div class="skel" style=${{ height: '420px', borderRadius: '20px' }}></div></div>`;
}

export function NoLocation({ title = t('Where are you dressing for?') }) {
  const save = (loc) => updateProfile({ location: loc }, { immediate: true, quiet: true }).catch(() => {});
  return html`<div class="card card-pad stack-l enter" style=${{ maxWidth: '520px', margin: '40px auto' }}>
    <div class="stack"><h1 class="display h-l">${title}</h1><p class="muted">${t('We check the forecast hour by hour, so every outfit is right for the weather you’ll actually be in.')}</p></div>
    <${LocationPicker} onPick=${save} />
  </div>`;
}

export function EmptyCloset({ missing, onDone }) {
  const [busy, setBusy] = useState(false);
  const starter = async () => {
    setBusy(true);
    try {
      await api.post('/garments/starter', {});
      await loadCloset(true);
      toast(t('Starter wardrobe added. Swap in your own pieces any time.'));
      onDone?.();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  const addTitle = missing?.includes('bottom') && !missing?.includes('top') ? t('Add some bottoms') : missing?.includes('top') && !missing?.includes('bottom') ? t('Add some tops') : t('Add some tops and bottoms');
  return html`<${Empty}
    title=${state.garments?.length ? addTitle : t('Your closet is empty')}
    text=${t('Add a few of the things you actually wear and we’ll start building outfits around them. Or begin with a starter wardrobe and swap pieces in as you go.')}
    art=${html`<${GarmentArt} type="tee" color="#f7f6f2" /><${GarmentArt} type="jeans" color="#2b3a55" /><${GarmentArt} type="sneakers" color="#f7f6f2" />`}>
    <div class="row-wrap" style=${{ justifyContent: 'center' }}>
      <button class="btn btn-primary" onClick=${() => navigate('/closet?add=1')}><${Icon} name="plus" />${t('Add a piece')}</button>
      <button class="btn btn-outline" onClick=${starter} disabled=${busy}>${busy ? html`<${Spinner} />` : null}${t('Start with a starter wardrobe')}</button>
    </div>
  </${Empty}>`;
}

export function TodayView() {
  const { user, profile } = useStore();
  // null until the person picks one: then what the day is for (an event they added) decides
  const [occasion, setOccasion] = useState(() => {
    try {
      return sessionStorage.getItem('mw.occasion') || null;
    } catch {
      return null; // storage blocked (private mode): the choice just is not remembered
    }
  });
  const [seed, setSeed] = useState(1);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [wornDates, setWorn] = useState({});
  const [loved, setLoved] = useState({});
  const [dir, setDir] = useState('l');
  const [dropped, setDropped] = useState([]);
  const [skipped, setSkipped] = useState([]); // pieces left out of today's suggestions: [{id, name}]
  const hasLocation = Boolean(profile?.location);
  // "Style it" from the closet: build outfits around one piece
  const [featureId, setFeatureId] = useState(() => useQuery().get('with'));
  const clearFeature = () => { setFeatureId(null); navigate('/', { replace: true }); };
  const feature = featureId ? (state.garments || []).find((g) => g.id === featureId) : null;
  const [s, setS] = useOutfits(undefined, occasion, hasLocation ? seed : 'x', skipped.map((p) => p.id), featureId);

  useEffect(() => {
    if (featureId && !state.garments) loadCloset().catch(() => {});
  }, [featureId]);

  useEffect(() => {
    try {
      if (occasion) sessionStorage.setItem('mw.occasion', occasion);
    } catch {
      /* not remembered */
    }
    setIndex(0);
    setDropped([]);
    setSkipped([]);
  }, [occasion]);
  useEffect(() => {
    setIndex(0);
    setDropped([]);
  }, [seed]);

  if (!hasLocation) return html`<${NoLocation} />`;

  const data = s.data;
  const activeOccasion = occasion ?? data?.occasion ?? 'casual';
  const outfits = (data?.outfits || []).filter((o) => !dropped.includes(o.key));
  const outfit = outfits[Math.min(index, outfits.length - 1)];
  const date = data?.date;
  const worn = outfit && data?.worn?.key === outfit.key ? true : outfit ? wornDates[outfit.key] : false;

  const wear = async () => {
    setBusy(true);
    try {
      await api.post('/outfits/wear', { date, itemIds: outfit.itemIds, occasion: activeOccasion, key: outfit.key });
      // one outfit per day: wearing this one replaces any other that was logged
      setWorn({ [outfit.key]: true });
      setS((p) => ({ ...p, data: p.data && { ...p.data, worn: { key: outfit.key } } }));
      toast(t('Logged. Enjoy the day.'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const undo = async () => {
    try {
      await api.del(`/outfits/wear?date=${date}`);
      setWorn((w) => ({ ...w, [outfit.key]: false }));
      setS((p) => ({ ...p, data: p.data && { ...p.data, worn: null } }));
    } catch (e) {
      fail(e);
    }
  };
  const love = async () => {
    if (loved[outfit.key]) return;
    setLoved((l) => ({ ...l, [outfit.key]: true }));
    try {
      await api.post('/outfits/feedback', { itemIds: outfit.itemIds, signal: 'love', key: outfit.key });
      toast(t('Noted. More like this.'));
    } catch (e) {
      setLoved((l) => ({ ...l, [outfit.key]: false }));
      fail(e);
    }
  };
  const dislike = async () => {
    const key = outfit.key;
    setDropped((d) => [...d, key]);
    setIndex(0);
    try {
      await api.post('/outfits/feedback', { itemIds: outfit.itemIds, signal: 'dislike', key });
      toast(t('Got it. We’ll steer away from that.'));
    } catch (e) {
      fail(e);
    }
    if (outfits.length <= 1) setSeed((x) => x + 1);
  };
  const share = async () => {
    try {
      const how = await shareOutfit({ outfit, weather: data.weather.day, date, units: data.weather.units });
      if (how === 'saved') toast(t('Picture saved. Share it anywhere.'));
    } catch {
      toast(t('Could not make the picture. Please try again.'), { kind: 'err' });
    }
  };
  const swap = (item) => {
    setSkipped((list) => (list.some((p) => p.id === item.id) ? list : [...list, { id: item.id, name: item.name }]));
    setIndex(0);
    // the swap is also a signal: this piece, in this combination, was not wanted
    api.post('/outfits/feedback', { itemIds: [item.id], signal: 'dislike' }).catch(() => {});
    toast(t('Swapped out {name}.', { name: item.name }));
  };
  const go = (delta) => {
    setDir(delta > 0 ? 'l' : 'r');
    setIndex((i) => (i + delta + outfits.length) % outfits.length);
  };

  // swipe between outfits on touch screens
  const touch = useRef(null);
  const onTouchStart = (e) => (touch.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touch.current == null || outfits.length < 2) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  };

  const pager = outfits.length > 1
    ? html`<div class="pager" style=${{ position: 'absolute', bottom: '14px', left: 0, right: 0, justifyContent: 'center' }}>
        <button class="icon-btn" style=${{ background: 'var(--surface)' }} aria-label=${t('Previous outfit')} onClick=${() => go(-1)}><${Icon} name="left" /></button>
        <div class="dots" aria-hidden="true">${outfits.map((_, i) => html`<i key=${i} class=${i === index ? 'on' : ''}></i>`)}</div>
        <button class="icon-btn" style=${{ background: 'var(--surface)' }} aria-label=${t('Next outfit')} onClick=${() => go(1)}><${Icon} name="right" /></button>
      </div>`
    : null;

  return html`<div class="stack-l">
    <header class="stack enter" style=${{ gap: '6px' }}>
      <h1 class="display h-xl">${greeting(new Date().getHours(), user?.name)}</h1>
    </header>

    ${data
      ? html`<${WeatherHero} weather=${data.weather} date=${data.date}><${Tips} tips=${data.tips} /></${WeatherHero}>`
      : s.loading ? null : null}

    <div class="chips-scroll enter enter-2" role="group" aria-label=${t('Occasion')}>
      ${occasionOptions().map((o) => html`<button key=${o.id} class="chip" aria-pressed=${activeOccasion === o.id ? 'true' : 'false'} onClick=${() => setOccasion(o.id)}>${o.label}</button>`)}
    </div>
    ${data?.plan && !featureId ? html`<div class="plan-banner enter"><${Icon} name="calendar" size="16" /><span>${t('On your plan: {what}', { what: data.plan.note || t(OCCASIONS[data.plan.occasion].label) })}</span></div>` : null}

    ${featureId
      ? html`<div class="feature-banner enter"><span class="grow">${feature ? t('Outfits built around {name}', { name: feature.name }) : t('Outfits built around one piece')}</span><button class="btn btn-ghost btn-s" onClick=${clearFeature}><${Icon} name="x" size="14" />${t('All outfits')}</button></div>`
      : null}
    ${data?.featureMissing && featureId
      ? html`<div class="card card-pad stack center"><p>${t('This piece doesn’t suit today’s weather or occasion. Try another occasion, or come back on a different day.')}</p><div><button class="btn btn-outline" onClick=${clearFeature}>${t('Show my usual outfits')}</button></div></div>`
      : null}

    ${s.loading && !data ? html`<${Skeleton} />` : null}
    ${s.error
      ? s.error.code === 'location_required'
        ? html`<${NoLocation} />`
        : html`<div class="card card-pad stack center"><p>${s.error.message}</p><div><button class="btn btn-outline" onClick=${() => setSeed((x) => x + 1)}>${t('Try again')}</button></div></div>`
      : null}
    ${data && !outfit && data.featureMissing ? null : data && !outfit && skipped.length
      ? html`<div class="card card-pad stack center"><p>${t('There are no other outfits without {names}.', { names: skipped.map((p) => p.name).join(', ') })}</p><div><button class="btn btn-outline" onClick=${() => setSkipped([])}>${t('Bring them back')}</button></div></div>`
      : data && !outfit ? html`<${EmptyCloset} missing=${data.missing} onDone=${() => setSeed((x) => x + 1)} />` : null}
    ${outfit
      ? html`<div key=${outfit.key} class=${dir === 'l' ? 'slide-l' : 'slide-r'} onTouchStart=${onTouchStart} onTouchEnd=${onTouchEnd} style=${{ opacity: s.loading ? 0.55 : 1, transition: 'opacity .2s' }}>
          <${OutfitCard}
            outfit=${outfit}
            occasionLabel=${t(OCCASIONS[activeOccasion].label)}
            pager=${pager}
            worn=${worn}
            busy=${busy}
            loved=${loved[outfit.key]}
            stylistNote=${data.stylistNote && index === 0 ? data.stylistNote : null}
            onWear=${wear}
            onUndo=${undo}
            onLove=${love}
            onDislike=${dislike}
            onSwap=${swap}
            onShare=${share}
            onShuffle=${() => setSeed((x) => x + 1)} />
        </div>`
      : null}
    ${skipped.length && outfit
      ? html`<div class="row-wrap small muted" style=${{ alignItems: 'center' }}><span>${t('Not using today:')}</span>${skipped.map((p) => html`<button key=${p.id} class="chip chip-s" title=${t('Use it again')} onClick=${() => setSkipped((l) => l.filter((x) => x.id !== p.id))}>${p.name}<${Icon} name="x" size="12" /></button>`)}</div>`
      : null}
    ${data?.stylistNote == null && state.entitlements?.plan === 'free' && outfit
      ? html`<div class="upsell enter"><div class="grow"><b>${t('Plan the whole week')}</b><p>${t('Free plans see 3 days. Pro plans every day, with a stylist’s notes.')}</p></div><button class="btn btn-s" onClick=${() => openUpgrade('plan')}>${t('See Pro')}</button></div>`
      : null}
  </div>`;
}
