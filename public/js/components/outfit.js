import { html } from '/js/ui.js';
import { Icon } from '/js/icons.js';
import { OutfitArt } from '/js/components/art.js';
import { Spinner } from '/js/components/common.js';

const REASON_ICON = { weather: 'thermo', protection: 'umbrella', style: 'heart', occasion: 'tag', color: 'sliders', fresh: 'sparkle' };

export function OutfitCard({ outfit, occasionLabel, pager, worn, busy, onWear, onUndo, onLove, onDislike, onShuffle, loved, compact = false, stylistNote }) {
  const label = `Outfit: ${outfit.items.map((i) => i.name).join(', ')}`;
  return html`<article class="card outfit card-lift" aria-label=${label}>
    <div class="outfit-board">
      <${OutfitArt} items=${outfit.items} label=${label} />
      ${pager || null}
    </div>
    <div class="outfit-body">
      <div class="spread" style=${{ alignItems: 'flex-start' }}>
        <div class="stack" style=${{ gap: '2px' }}>
          <span class="eyebrow">${occasionLabel} outfit</span>
          <div class="match"><b class="num">${outfit.score}</b><span class="muted small">match</span></div>
        </div>
        <div class="row" style=${{ gap: '8px' }}>
          <button class=${`icon-btn ${loved ? 'on' : ''}`} aria-label="Love this outfit" aria-pressed=${loved ? 'true' : 'false'} onClick=${onLove}><${Icon} name="heart" /></button>
          <button class="icon-btn" aria-label="Not for me" onClick=${onDislike}><${Icon} name="x" /></button>
        </div>
      </div>

      ${stylistNote ? html`<p class="display" style=${{ fontSize: '22px', lineHeight: 1.2 }}>${stylistNote}</p>` : null}
      ${outfit.note ? html`<p class="stylist-note"><${Icon} name="sparkle" size="15" /><span><b>Your stylist:</b> ${outfit.note}</span></p>` : null}

      <ul class="reasons">
        ${outfit.reasons.map((r) => html`<li key=${r.text}><${Icon} name=${REASON_ICON[r.kind] || 'check'} /><span>${r.text}</span></li>`)}
      </ul>
      ${outfit.warnings?.length ? html`<ul class="reasons warn">${outfit.warnings.map((w) => html`<li key=${w}><${Icon} name="info" /><span>${w}</span></li>`)}</ul>` : null}

      <div class="pieces">
        ${outfit.items.map((i) => html`<span class="piece-chip" key=${i.id}><i style=${{ background: i.color }}></i>${i.name}</span>`)}
      </div>

      <div class="action-row">
        ${!onWear
          ? null
          : worn
            ? html`<button class="btn btn-outline" onClick=${onUndo} disabled=${busy}><${Icon} name="check" />Wearing this today. Undo</button>`
            : html`<button class="btn btn-primary" onClick=${onWear} disabled=${busy}>${busy ? html`<${Spinner} />` : html`<${Icon} name="check" />`}I’m wearing this</button>`}
        <button class="btn btn-ghost" onClick=${onShuffle}><${Icon} name="refresh" />Show me others</button>
      </div>
    </div>
  </article>`;
}
