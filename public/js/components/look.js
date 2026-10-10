import { html, useState } from '/js/ui.js';
import { t, tn, tx } from '/js/i18n.js';
import { L } from '/shared/i18n.js';
import { api } from '/js/api.js';
import { toast, fail } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { GarmentArt, OutfitArt } from '/js/components/art.js';
import { money } from '/js/format.js';
import { TYPES } from '/shared/taxonomy.js';

const SLOT_ORDER = { top: 0, dress: 0, layer: 1, bottom: 2, outerwear: 3, shoes: 4, accessory: 5 };
const KIND_LABEL = { new: L('New outfit'), owned: L('Built around your closet') };

function PieceImage({ p }) {
  const src = p.product?.image || p.imageUrl;
  return src
    ? html`<img class=${/\/uploads\/.*\.png/.test(src) ? 'cutout' : ''} src=${src} alt=${p.name} loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : html`<${GarmentArt} type=${p.type} color=${p.color} pattern=${p.pattern || 'solid'} />`;
}

/** Real product photos when we have them; the illustrated flat-lay otherwise. */
export function Collage({ look }) {
  const main = [...look.pieces].filter((p) => p.slot !== 'accessory').sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  const withPhotos = main.filter((p) => p.product?.image || p.imageUrl).length;
  // a collage of mostly illustrations looks patchy: use real photos only when most pieces have one
  if (withPhotos < Math.min(3, main.length)) return html`<div class="collage"><${OutfitArt} items=${look.pieces} label=${t('Illustration of {title}', { title: look.title })} /></div>`;
  const cells = main.slice(0, 4);
  return html`<div class="collage" role="img" aria-label=${t('Collage for {title}', { title: look.title })}>
    <div class=${`collage-grid n${Math.min(4, Math.max(2, cells.length))}`}>
      ${cells.map((p) => html`<div class="collage-cell" key=${p.slot + p.name}><${PieceImage} p=${p} />${p.retailer ? html`<span class="collage-tag">${p.retailer.name}</span>` : html`<span class="collage-tag">${t('Yours')}</span>`}</div>`)}
    </div>
  </div>`;
}

function PieceRow({ p, onDislikePiece, removed }) {
  const price = p.product?.priceCents ? money(p.product.priceCents, p.product.currency) : null;
  if (removed) return html`<li class="piece-row"><span class="sw" style=${{ background: p.color, opacity: 0.35 }}></span><div><div class="nm" style=${{ textDecoration: 'line-through', opacity: 0.6 }}>${p.name}</div><div class="rt">${t('Removed. You’ll get different pieces in new looks.')}</div></div></li>`;
  return html`<li class="piece-row">
    <span class="sw" style=${{ background: p.color }}></span>
    <div>
      <div class="nm">${p.name}</div>
      <div class="rt">${p.source === 'owned' ? t('In your closet') : html`${p.retailer?.name}${price ? html` · <span class="price">${price}</span>` : ` · ${t('{band} est.', { band: p.retailer?.band })}`}${p.source === 'spec' ? ` · ${t('opens a search')}` : ''}`}</div>
    </div>
    <div class="row" style=${{ gap: '6px' }}>
      ${p.link
        ? html`<a class="shop-link" href=${p.link} target="_blank" rel="noopener sponsored" aria-label=${`Shop ${p.name} at ${p.retailer.name}`}>${t('Shop')} <${Icon} name="external" /></a>`
        : null}
      ${p.source !== 'owned' && onDislikePiece ? html`<button class="icon-btn" style=${{ width: '30px', height: '30px' }} aria-label=${`Dislike ${p.name}`} title=${t('Dislike this piece')} onClick=${onDislikePiece}><${Icon} name="thumbdown" size="14" /></button>` : null}
    </div>
  </li>`;
}

export function LookCard({ look, saved, onSaved, onUnsave, onHide, readOnly = false }) {
  const [rate, setRate] = useState('');
  const [gone, setGone] = useState({});
  const [busy, setBusy] = useState(false);
  const send = async (signal, extra = {}) => {
    try {
      return await api.post('/shop/feedback', { lookId: look.id, signal, ...extra });
    } catch (e) {
      fail(e);
      throw e;
    }
  };
  const love = async () => {
    if (rate === 'love') return;
    setRate('love');
    send('love').then(() => toast(t('Noted. We’ll find more like this.'))).catch(() => setRate(''));
  };
  const dislike = async () => {
    send('dislike').then(() => { toast(t('Got it. We’ll steer away from looks like that.')); onHide?.(look); }).catch(() => {});
  };
  const save = async () => {
    setBusy(true);
    try {
      const { id } = await api.post('/shop/saved', { lookId: look.id });
      onSaved?.(look, id);
      toast(t('Saved to your list'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const priced = look.totalCents;
  const stores = look.storeCount;

  return html`<article class="card look enter" aria-label=${look.title}>
    <div style=${{ position: 'relative' }}>
      <${Collage} look=${look} />
      <div class="look-top">
        <span class=${`badge ${look.kind === 'owned' ? 'badge-ok' : ''}`}>${t(KIND_LABEL[look.kind])}</span>
        <span class="badge num" style=${{ background: 'var(--surface)' }}>${t('{n}% match', { n: look.score })}</span>
      </div>
    </div>
    <div class="look-body">
      <div class="stack" style=${{ gap: '6px' }}>
        <span class="eyebrow">${look.archetypeLabel}</span>
        <h2 class="look-title">${look.title}</h2>
      </div>
      ${look.note ? html`<p class="stylist-note"><${Icon} name="sparkle" size="15" /><span><b>${t('Your stylist:')}</b> ${look.note}</span></p>` : null}
      <ul class="reasons">${look.reasons.slice(0, 3).map((r) => html`<li key=${r}><${Icon} name="check" /><span>${r}</span></li>`)}</ul>
      <ul class="piece-rows">${look.pieces.map((p, i) => html`<${PieceRow} key=${p.slot + p.name} p=${p} removed=${Boolean(gone[i])} onDislikePiece=${readOnly ? null : () => send('dislike', { pieceIndex: i }).then(() => { setGone((g) => ({ ...g, [i]: true })); toast(t('Removed. We’ll avoid pieces like that.')); }).catch(() => {})} />`)}</ul>
      <div class="spread" style=${{ flexWrap: 'wrap' }}>
        <div class="small muted">
          ${priced ? tx(tn(look.newCount, '{price} for {n} new piece', '{price} for {n} new pieces'), { price: html`<b class="price" style=${{ color: 'var(--ink)' }}>${money(priced, look.currency)}</b>` }) : tn(look.newCount, '{n} new piece', '{n} new pieces')}
          ${stores > 0 ? ` · ${stores === 1 ? t('one store') : t('{n} stores', { n: stores })}` : ''}
        </div>
        ${readOnly
          ? html`<button class="btn btn-ghost btn-s" onClick=${onUnsave}><${Icon} name="trash" />${t('Remove')}</button>`
          : html`<div class="look-actions">
              <button class=${`btn btn-outline btn-s rate ${rate === 'love' ? 'on' : ''}`} aria-label=${t('Love this look')} aria-pressed=${rate === 'love' ? 'true' : 'false'} onClick=${love}><${Icon} name="heart" />${rate === 'love' ? t('Loved') : t('Love')}</button>
              <button class="btn btn-outline btn-s rate" aria-label=${t('Dislike this look')} title=${t('Hide this look and learn what you don’t like')} onClick=${dislike}><${Icon} name="thumbdown" />${t('Dislike')}</button>
              ${saved ? html`<button class="btn btn-outline btn-s" onClick=${() => onUnsave?.(look, saved)}><${Icon} name="check" />${t('Saved')}</button>` : html`<button class="btn btn-primary btn-s" onClick=${save} disabled=${busy}><${Icon} name="bookmark" />${t('Save')}</button>`}
            </div>`}
      </div>
    </div>
  </article>`;
}

export function GapCard({ gap }) {
  return html`<article class="card gap-card enter">
    <div class="stack" style=${{ gap: '6px' }}>
      <div class="row"><span class=${`badge ${gap.severity === 'high' ? 'badge-clay' : ''}`}>${gap.severity === 'high' ? t('Worth getting soon') : gap.severity === 'medium' ? t('Good to have') : t('Nice to have')}</span></div>
      <h2 class="display h-s">${gap.title}</h2>
      <p class="muted small">${gap.why}</p>
    </div>
    <div class="gap-pieces">
      ${gap.pieces.map((p) => html`<div class="mini" key=${p.name}>
        <div class="ph"><${PieceImage} p=${p} /></div>
        <div class="stack" style=${{ gap: '2px' }}>
          <div class="small" style=${{ fontWeight: 550, lineHeight: 1.25 }}>${p.name}</div>
          <div class="tiny faint">${p.retailer.name}${p.product?.priceCents ? ` · ${money(p.product.priceCents, p.product.currency)}` : ` · ${t('{band} est.', { band: p.retailer.band })}`}</div>
          ${p.pairsWith ? html`<div class="tiny" style=${{ color: 'var(--ok)' }}>${t('Pairs with {n} of your pieces', { n: p.pairsWith })}</div>` : null}
        </div>
        <a class="shop-link" style=${{ justifySelf: 'start' }} href=${p.link} target="_blank" rel="noopener sponsored">${t('Shop at {store}', { store: p.retailer.name })} <${Icon} name="external" /></a>
      </div>`)}
    </div>
  </article>`;
}
export { TYPES };
