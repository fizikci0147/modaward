import { html, useState, useEffect } from '/js/ui.js';
import { t, tn, getLocale } from '/js/i18n.js';
import { api } from '/js/api.js';
import { useStore } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { GarmentArt } from '/js/components/art.js';
import { Link, navigate } from '/js/router.js';
import { CATEGORIES, TYPES } from '/shared/taxonomy.js';
import { agoText } from '/shared/dormancy.js';
import { money, todayLocal } from '/js/format.js';

const Tile = ({ label, value, sub }) => html`<div class="card stat"><span class="eyebrow">${label}</span><b class="num">${value}</b>${sub ? html`<span class="small muted">${sub}</span>` : null}</div>`;

function Thumb({ g }) {
  return html`<span class="ins-thumb">${g.imageUrl ? html`<img class=${/\.png/.test(g.imageUrl) ? 'cutout' : ''} src=${g.imageUrl} alt="" loading="lazy" decoding="async" />` : html`<${GarmentArt} type=${g.type} color=${g.color} />`}</span>`;
}

function PieceRow({ g, right, sub }) {
  return html`<li class="ins-row"><${Thumb} g=${g} /><span class="stack" style=${{ gap: '1px', minWidth: 0 }}><b class="ins-name">${g.name}</b><span class="small muted">${sub}</span></span><span class="num small ins-right">${right}</span></li>`;
}

/** How the closet is actually used: what gets worn, what pays for itself, what is missing. */
export function ClosetInsights({ onShowIdle }) {
  const { profile } = useStore();
  const currency = profile?.currency || 'USD';
  const [stats, setStats] = useState(null);
  const [gaps, setGaps] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/insights/wardrobe?today=${todayLocal()}`).then((r) => setStats(r.stats)).catch(setError);
    if (profile?.location) api.post('/shop/gaps', {}).then((r) => setGaps(r.gaps)).catch(() => setGaps([]));
    else setGaps([]);
  }, []);

  if (error) return html`<div class="card card-pad center">${error.message}</div>`;
  if (!stats) return html`<div class="grid-tiles">${[1, 2, 3, 4].map((i) => html`<div key=${i} class="skel" style=${{ height: '96px', borderRadius: '20px' }}></div>`)}</div>`;
  if (!stats.pieces) return html`<div class="card card-pad center muted">${t('Add some pieces and your closet’s numbers will show up here.')}</div>`;

  const maxPieces = Math.max(...stats.byCategory.map((c) => c.pieces), 1);
  const maxWears = Math.max(...stats.byCategory.map((c) => c.wears), 1);
  const cpw = (cents) => money(cents, currency);

  return html`<div class="stack-l">
    <div class="grid-tiles enter">
      <${Tile} label=${t('Pieces')} value=${stats.pieces} sub=${t('{n} worn at least once', { n: stats.pieces - stats.neverWorn })} />
      <${Tile} label=${t('Worn in the last 30 days')} value=${`${stats.utilization30}%`} sub=${tn(stats.worn30, '{n} piece', '{n} pieces')} />
      <${Tile} label=${t('Never worn')} value=${stats.neverWorn} sub=${stats.neverWorn ? t('Log wears to see the full picture') : t('Everything has had an outing')} />
      ${stats.pricedCount ? html`<${Tile} label=${t('Closet value')} value=${cpw(stats.totalValueCents)} sub=${stats.avgCpwCents != null ? t('{price} per wear on average', { price: cpw(stats.avgCpwCents) }) : t('Wear things to see cost per wear')} />` : null}
    </div>

    ${!stats.hasWearData ? html`<p class="rem-tip small"><${Icon} name="info" size="16" /><span>${t('These numbers grow as you log what you wear: tap “I’m wearing this” on Today, or “Wore it today” on any piece.')}</span></p>` : null}

    ${stats.mostWorn.length
      ? html`<section class="card card-pad stack enter"><h2 class="display h-s">${t('Most worn')}</h2><ul class="ins-list">${stats.mostWorn.map((g) => html`<${PieceRow} key=${g.id} g=${g} sub=${t(TYPES[g.type]?.label || '')} right=${g.cpwCents != null ? `${t('worn {n}×', { n: g.wearCount })} · ${t('{price} per wear', { price: cpw(g.cpwCents) })}` : t('worn {n}×', { n: g.wearCount })} />`)}</ul></section>`
      : null}

    ${stats.bestValue.length
      ? html`<section class="card card-pad stack enter"><h2 class="display h-s">${t('Best value')}</h2><p class="muted small">${t('The pieces that have paid for themselves the most.')}</p><ul class="ins-list">${stats.bestValue.map((g) => html`<${PieceRow} key=${g.id} g=${g} sub=${t('{price} paid', { price: cpw(g.priceCents) })} right=${t('{price} per wear', { price: cpw(g.cpwCents) })} />`)}</ul></section>`
      : null}

    ${stats.worthWearing.length
      ? html`<section class="card card-pad stack enter"><h2 class="display h-s">${t('Worth wearing more')}</h2><p class="muted small">${t('Costly per wear so far. Every wear brings the cost down.')}</p><ul class="ins-list">${stats.worthWearing.map((g) => html`<${PieceRow} key=${g.id} g=${g} sub=${g.wearCount ? `${t('{price} paid', { price: cpw(g.priceCents) })} · ${t('worn {n}×', { n: g.wearCount })}` : `${t('{price} paid', { price: cpw(g.priceCents) })} · ${t('Not worn yet')}`} right=${t('{price} per wear', { price: cpw(g.cpwCents) })} />`)}</ul></section>`
      : null}

    ${!stats.pricedCount
      ? html`<section class="card card-pad stack enter"><h2 class="display h-s">${t('Cost per wear')}</h2><p class="muted small">${t('Add what you paid on a piece (open it, then “What you paid”) and we will show which pieces earn their place.')}</p></section>`
      : null}

    <section class="card card-pad stack enter">
      <h2 class="display h-s">${t('What the closet is made of')}</h2>
      <div class="ins-bars" role="list">
        ${stats.byCategory.map((c) => html`<div class="ins-bar" role="listitem" key=${c.category}>
          <span class="small">${t(CATEGORIES[c.category]?.label || c.category)}</span>
          <span class="ins-track" title=${t('{n} pieces', { n: c.pieces })}><i style=${{ width: `${(c.pieces / maxPieces) * 100}%` }}></i></span>
          <span class="ins-track wears" title=${t('worn {n}×', { n: c.wears })}><i style=${{ width: `${(c.wears / maxWears) * 100}%` }}></i></span>
          <span class="small muted num">${c.pieces} · ${c.wears}×</span>
        </div>`)}
      </div>
      <p class="tiny faint">${t('Bars: pieces you own, then times worn.')}</p>
    </section>

    ${stats.dormant
      ? html`<section class="card card-pad stack enter">
          <div class="spread" style=${{ flexWrap: 'wrap', gap: '8px' }}><h2 class="display h-s">${t('Not worn in a while')}</h2><button class="btn btn-ghost btn-s" onClick=${onShowIdle}>${t('See all {n}', { n: stats.dormant })}</button></div>
          <ul class="ins-list">${stats.dormantTop.map((g) => html`<${PieceRow} key=${g.id} g=${g} sub=${g.neverWorn ? t('Not worn yet · added {when}', { when: agoText(g.idleDays, getLocale()) }) : t('Last worn {when}', { when: agoText(g.idleDays, getLocale()) })} right=${html`<button class="btn btn-outline btn-s" onClick=${() => navigate(`/?with=${g.id}`)}><${Icon} name="sparkle" size="14" />${t('Style it')}</button>`} />`)}</ul>
        </section>`
      : null}

    ${gaps && gaps.length
      ? html`<section class="card card-pad stack enter">
          <h2 class="display h-s">${t('What’s missing')}</h2>
          <ul class="ins-list">${gaps.slice(0, 3).map((g) => html`<li class="ins-gap" key=${g.id}><b>${g.title}</b><span class="small muted">${g.why}</span></li>`)}</ul>
          <div><${Link} href="/shop?tab=gaps" class="btn btn-outline">${t('See where to find them')}</${Link}></div>
        </section>`
      : null}

    <section class="card card-pad row enter" style=${{ gap: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <div class="stack" style=${{ gap: '2px' }}><h2 class="display h-s">${t('Packing for a trip?')}</h2><p class="muted small">${t('Get a short packing list that works for every day of the forecast.')}</p></div>
      <${Link} href="/trip" class="btn btn-primary"><${Icon} name="bag" />${t('Plan a packing list')}</${Link}>
    </section>
  </div>`;
}
