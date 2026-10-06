import { html, useState } from '/js/ui.js';
import { api } from '/js/api.js';
import { toast, fail } from '/js/store.js';
import { Icon } from '/js/icons.js';
import { GarmentArt, OutfitArt } from '/js/components/art.js';
import { money } from '/js/format.js';
import { TYPES } from '/shared/taxonomy.js';

const SLOT_ORDER = { top: 0, dress: 0, layer: 1, bottom: 2, outerwear: 3, shoes: 4, accessory: 5 };
const KIND_LABEL = { new: 'New outfit', owned: 'Built around your closet' };

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
  if (withPhotos < 2) return html`<div class="collage"><${OutfitArt} items=${look.pieces} label=${`Illustration of ${look.title}`} /></div>`;
  const cells = main.slice(0, 4);
  return html`<div class="collage" role="img" aria-label=${`Collage for ${look.title}`}>
    <div class=${`collage-grid n${Math.min(4, Math.max(2, cells.length))}`}>
      ${cells.map((p) => html`<div class="collage-cell" key=${p.slot + p.name}><${PieceImage} p=${p} />${p.retailer ? html`<span class="collage-tag">${p.retailer.name}</span>` : html`<span class="collage-tag">Yours</span>`}</div>`)}
    </div>
  </div>`;
}

function PieceRow({ p, onDislikePiece }) {
  const price = p.product?.priceCents ? money(p.product.priceCents, p.product.currency) : null;
  return html`<li class="piece-row">
    <span class="sw" style=${{ background: p.color }}></span>
    <div>
      <div class="nm">${p.name}</div>
      <div class="rt">${p.source === 'owned' ? 'In your closet' : html`${p.retailer?.name}${price ? html` · <span class="price">${price}</span>` : ` · ${p.retailer?.band} est.`}${p.source === 'spec' ? ' · opens a search' : ''}`}</div>
    </div>
    <div class="row" style=${{ gap: '6px' }}>
      ${p.link
        ? html`<a class="shop-link" href=${p.link} target="_blank" rel="noopener sponsored" aria-label=${`Shop ${p.name} at ${p.retailer.name}`}>Shop <${Icon} name="external" /></a>`
        : null}
      ${p.source !== 'owned' && onDislikePiece ? html`<button class="icon-btn" style=${{ width: '30px', height: '30px' }} aria-label="Not this piece" title="Not this piece" onClick=${onDislikePiece}><${Icon} name="x" size="14" /></button>` : null}
    </div>
  </li>`;
}

export function LookCard({ look, saved, onSaved, onUnsave, onHide, readOnly = false }) {
  const [rate, setRate] = useState('');
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
    send('love').then(() => toast('Noted. We’ll find more like this.')).catch(() => setRate(''));
  };
  const dislike = async () => {
    send('dislike').then(() => { toast('Got it. We’ll steer away from looks like that.'); onHide?.(look); }).catch(() => {});
  };
  const save = async () => {
    setBusy(true);
    try {
      const { id } = await api.post('/shop/saved', { lookId: look.id });
      onSaved?.(look, id);
      toast('Saved to your list');
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
        <span class=${`badge ${look.kind === 'owned' ? 'badge-ok' : ''}`}>${KIND_LABEL[look.kind]}</span>
        <span class="badge num" style=${{ background: 'var(--surface)' }}>${look.score}% match</span>
      </div>
    </div>
    <div class="look-body">
      <div class="stack" style=${{ gap: '6px' }}>
        <span class="eyebrow">${look.archetypeLabel}</span>
        <h3 class="look-title">${look.title}</h3>
      </div>
      <ul class="reasons">${look.reasons.slice(0, 3).map((r) => html`<li key=${r}><${Icon} name="check" /><span>${r}</span></li>`)}</ul>
      <ul class="piece-rows">${look.pieces.map((p, i) => html`<${PieceRow} key=${p.slot + p.name} p=${p} onDislikePiece=${readOnly ? null : () => send('dislike', { pieceIndex: i }).then(() => toast('We’ll avoid pieces like that.')).catch(() => {})} />`)}</ul>
      <div class="spread" style=${{ flexWrap: 'wrap' }}>
        <div class="small muted">
          ${priced ? html`<b class="price" style=${{ color: 'var(--ink)' }}>${money(priced, look.currency)}</b> for ${look.newCount} new ${look.newCount === 1 ? 'piece' : 'pieces'}` : `${look.newCount} new ${look.newCount === 1 ? 'piece' : 'pieces'}`}
          ${stores > 0 ? ` · ${stores === 1 ? 'one store' : `${stores} stores`}` : ''}
        </div>
        ${readOnly
          ? html`<button class="btn btn-ghost btn-s" onClick=${onUnsave}><${Icon} name="trash" />Remove</button>`
          : html`<div class="look-actions">
              <button class=${`icon-btn ${rate === 'love' ? 'on' : ''}`} aria-label="Love this look" aria-pressed=${rate === 'love' ? 'true' : 'false'} onClick=${love}><${Icon} name="heart" /></button>
              <button class="icon-btn" aria-label="Not for me" onClick=${dislike}><${Icon} name="x" /></button>
              ${saved ? html`<button class="btn btn-outline btn-s" onClick=${() => onUnsave?.(look, saved)}><${Icon} name="check" />Saved</button>` : html`<button class="btn btn-primary btn-s" onClick=${save} disabled=${busy}><${Icon} name="bookmark" />Save</button>`}
            </div>`}
      </div>
    </div>
  </article>`;
}

export function GapCard({ gap }) {
  return html`<article class="card gap-card enter">
    <div class="stack" style=${{ gap: '6px' }}>
      <div class="row"><span class=${`badge ${gap.severity === 'high' ? 'badge-clay' : ''}`}>${gap.severity === 'high' ? 'Worth getting soon' : gap.severity === 'medium' ? 'Good to have' : 'Nice to have'}</span></div>
      <h3 class="display h-s">${gap.title}</h3>
      <p class="muted small">${gap.why}</p>
    </div>
    <div class="gap-pieces">
      ${gap.pieces.map((p) => html`<div class="mini" key=${p.name}>
        <div class="ph"><${PieceImage} p=${p} /></div>
        <div class="stack" style=${{ gap: '2px' }}>
          <div class="small" style=${{ fontWeight: 550, lineHeight: 1.25 }}>${p.name}</div>
          <div class="tiny faint">${p.retailer.name}${p.product?.priceCents ? ` · ${money(p.product.priceCents, p.product.currency)}` : ` · ${p.retailer.band} est.`}</div>
          ${p.pairsWith ? html`<div class="tiny" style=${{ color: 'var(--ok)' }}>Pairs with ${p.pairsWith} of your pieces</div>` : null}
        </div>
        <a class="shop-link" style=${{ justifySelf: 'start' }} href=${p.link} target="_blank" rel="noopener sponsored">Shop at ${p.retailer.name} <${Icon} name="external" /></a>
      </div>`)}
    </div>
  </article>`;
}
export { TYPES };
