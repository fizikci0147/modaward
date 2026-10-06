import { html, useMemo } from '/js/ui.js';
import { garmentMarkup, outfitMarkup, viewBoxFor } from '/js/art.js';
import { TYPES } from '/shared/taxonomy.js';

const cache = new Map();
function markup(art, color, pattern) {
  const key = `${art}|${color}|${pattern}`;
  let m = cache.get(key);
  if (!m) {
    m = garmentMarkup(art, color, pattern);
    if (cache.size > 800) cache.clear();
    cache.set(key, m);
  }
  return m;
}

/** One garment illustration (or nothing if the type is unknown). */
export function GarmentArt({ type, color = '#cccccc', pattern = 'solid', class: cls = '', fit = true }) {
  const art = TYPES[type]?.art || 'tee';
  const inner = useMemo(() => markup(art, color, pattern), [art, color, pattern]);
  return html`<svg class=${cls} viewBox=${fit ? viewBoxFor(art) : '0 0 100 100'} aria-hidden="true" dangerouslySetInnerHTML=${{ __html: inner }} />`;
}

const toArtItem = (g) => ({ art: TYPES[g.type]?.art || 'tee', category: g.category || TYPES[g.type]?.category, color: g.color, pattern: g.pattern || 'solid' });

/** A flat-lay board for a set of garments or look pieces. */
export function OutfitArt({ items, class: cls = '', label }) {
  const inner = useMemo(() => outfitMarkup(items.map(toArtItem)), [items.map((g) => `${g.type}${g.color}${g.pattern}`).join('|')]);
  return html`<svg class=${`art ${cls}`} viewBox="0 0 300 360" role=${label ? 'img' : undefined} aria-label=${label} aria-hidden=${label ? undefined : 'true'} dangerouslySetInnerHTML=${{ __html: inner }} />`;
}
