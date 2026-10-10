import { html, useState, useEffect, useRef } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { Icon } from '/js/icons.js';
import { OutfitArt } from '/js/components/art.js';
import { Spinner } from '/js/components/common.js';

const REASON_ICON = { weather: 'thermo', protection: 'umbrella', style: 'heart', occasion: 'tag', color: 'sliders', fresh: 'sparkle', trend: 'sparkle' };

/** One piece of the outfit, with its "not this one" control: just for today, or never again. */
function PieceChip({ item, onSwap, onSeparate, onExclude, only }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !menuRef.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    menuRef.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const choices = [onSeparate && [onSeparate, t('Doesn’t go with this look')], onSwap && [onSwap, t('Not today')], onExclude && [onExclude, t('Never suggest this piece')]].filter(Boolean);
  const both = choices.length > 1;
  const choose = (fn) => () => { setOpen(false); fn(item); };
  return html`<span class="piece-chip" key=${item.id}><i style=${{ background: item.color }}></i>${item.name}
    ${only && choices.length
      ? null
      : both
        ? html`<span class="chip-menu-wrap" ref=${menuRef}>
            <button class="chip-x" aria-haspopup="menu" aria-expanded=${open ? 'true' : 'false'} aria-label=${t('Swap out {name}', { name: item.name })} title=${t('Not this piece: swap it for something else')} onClick=${() => setOpen(!open)}><${Icon} name="x" size="12" /></button>
            ${open ? html`<span class="chip-menu" role="menu">${choices.map(([fn, label]) => html`<button key=${label} role="menuitem" onClick=${choose(fn)}>${label}</button>`)}</span>` : null}
          </span>`
        : html`<button class="chip-x" aria-label=${onSwap ? t('Swap out {name}', { name: item.name }) : t('Never suggest {name}', { name: item.name })} title=${onSwap ? t('Not this piece: swap it for something else') : t('Never suggest this piece')} onClick=${() => choices[0][0](item)}><${Icon} name="x" size="12" /></button>`}
  </span>`;
}

export function OutfitCard({ outfit, occasionLabel, pager, worn, busy, onWear, onUndo, onLove, onDislike, onSwap, onSeparate, onExclude, onShuffle, onShare, loved, compact = false, stylistNote }) {
  const label = t('Outfit: {items}', { items: outfit.items.map((i) => i.name).join(', ') });
  return html`<article class="card outfit card-lift" aria-label=${label}>
    <div class="outfit-board">
      <${OutfitArt} items=${outfit.items} label=${label} />
      ${pager || null}
    </div>
    <div class="outfit-body">
      <div class="spread" style=${{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div class="stack" style=${{ gap: '2px' }}>
          <span class="eyebrow">${t('{occasion} outfit', { occasion: occasionLabel })}</span>
          <div class="match"><b class="num">${outfit.score}</b><span class="muted small">${t('match')}</span></div>
        </div>
        <div class="row" style=${{ gap: '8px' }}>
          <button class=${`btn btn-outline btn-s rate ${loved ? 'on' : ''}`} aria-label=${t('Love this outfit')} aria-pressed=${loved ? 'true' : 'false'} onClick=${onLove}><${Icon} name="heart" />${loved ? t('Loved') : t('Love')}</button>
          <button class="btn btn-outline btn-s rate" aria-label=${t('Dislike this outfit')} title=${t('We won’t suggest this outfit again and will learn what you don’t like')} onClick=${onDislike}><${Icon} name="thumbdown" />${t('Dislike')}</button>
        </div>
      </div>

      ${stylistNote ? html`<p class="display" style=${{ fontSize: '22px', lineHeight: 1.2 }}>${stylistNote}</p>` : null}
      ${outfit.note ? html`<p class="stylist-note"><${Icon} name="sparkle" size="15" /><span><b>${t('Your stylist:')}</b> ${outfit.note}</span></p>` : null}

      <ul class="reasons">
        ${outfit.reasons.map((r) => html`<li key=${r.text}><${Icon} name=${REASON_ICON[r.kind] || 'check'} /><span>${r.text}</span></li>`)}
      </ul>
      ${outfit.warnings?.length ? html`<ul class="reasons warn">${outfit.warnings.map((w) => html`<li key=${w}><${Icon} name="info" /><span>${w}</span></li>`)}</ul>` : null}

      <div class="pieces">
        ${outfit.items.map((i) => html`<${PieceChip} key=${i.id} item=${i} onSwap=${onSwap} onSeparate=${onSeparate} onExclude=${onExclude} only=${outfit.items.length < 2} />`)}
      </div>

      <div class="action-row">
        ${!onWear
          ? null
          : worn
            ? html`<button class="btn btn-outline" onClick=${onUndo} disabled=${busy}><${Icon} name="check" />${t('Wearing this today. Undo')}</button>`
            : html`<button class="btn btn-primary" onClick=${onWear} disabled=${busy}>${busy ? html`<${Spinner} />` : html`<${Icon} name="check" />`}${t('I’m wearing this')}</button>`}
        <button class="btn btn-ghost" onClick=${onShuffle}><${Icon} name="refresh" />${t('Show me others')}</button>
        ${onShare ? html`<button class="btn btn-ghost" onClick=${onShare} aria-label=${t('Share this outfit as a picture')}><${Icon} name="share" />${t('Share')}</button>` : null}
      </div>
    </div>
  </article>`;
}
