import { html } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { Icon } from '/js/icons.js';
import { OutfitArt } from '/js/components/art.js';
import { Spinner } from '/js/components/common.js';

const REASON_ICON = { weather: 'thermo', protection: 'umbrella', style: 'heart', occasion: 'tag', color: 'sliders', fresh: 'sparkle' };

export function OutfitCard({ outfit, occasionLabel, pager, worn, busy, onWear, onUndo, onLove, onDislike, onSwap, onShuffle, loved, compact = false, stylistNote }) {
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
        ${outfit.items.map((i) => html`<span class="piece-chip" key=${i.id}><i style=${{ background: i.color }}></i>${i.name}${onSwap && outfit.items.length > 1 ? html`<button class="chip-x" aria-label=${t('Swap out {name}', { name: i.name })} title=${t('Not this piece: swap it for something else')} onClick=${() => onSwap(i)}><${Icon} name="x" size="12" /></button>` : null}</span>`)}
      </div>

      <div class="action-row">
        ${!onWear
          ? null
          : worn
            ? html`<button class="btn btn-outline" onClick=${onUndo} disabled=${busy}><${Icon} name="check" />${t('Wearing this today. Undo')}</button>`
            : html`<button class="btn btn-primary" onClick=${onWear} disabled=${busy}>${busy ? html`<${Spinner} />` : html`<${Icon} name="check" />`}${t('I’m wearing this')}</button>`}
        <button class="btn btn-ghost" onClick=${onShuffle}><${Icon} name="refresh" />${t('Show me others')}</button>
      </div>
    </div>
  </article>`;
}
