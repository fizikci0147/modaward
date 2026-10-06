/** "Your style DNA": what the taste model has learned and what the closet says, in plain words. */
import { ARCHETYPES, TYPES } from '../shared/taxonomy.js';
import { TasteModel } from './taste.js';
import { colorRole } from '../shared/color.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Turn a feature key into a phrase a person would say. */
export function humanize(feature) {
  const [kind, rest] = [feature.slice(0, feature.indexOf(':')), feature.slice(feature.indexOf(':') + 1)];
  switch (kind) {
    case 'type': return TYPES[rest]?.label.toLowerCase() ?? rest;
    case 'color': return rest;
    case 'pattern': return rest === 'striped' ? 'stripes' : rest === 'checked' ? 'checks' : rest;
    case 'brand': return cap(rest);
    case 'style': return `${ARCHETYPES[rest]?.label.toLowerCase() ?? rest} style`;
    case 'pair': return rest.split('+').map((t) => TYPES[t]?.label.toLowerCase() ?? t).join(' with ');
    case 'cpair': return rest.replace('+', ' with ');
    default: return null;
  }
}

export function buildInsights({ tasteState, garments }) {
  const model = new TasteModel(tasteState);
  const raw = model.insights(10);
  const phrases = (list) => [...new Set(list.map((x) => humanize(x.feature)).filter(Boolean))].slice(0, 5);

  const palette = new Map();
  const styleTally = {};
  let neutral = 0;
  for (const g of garments) {
    if (g.category === 'accessory') continue;
    const p = palette.get(g.colorName) || { name: g.colorName, hex: g.color, count: 0 };
    p.count += 1;
    palette.set(g.colorName, p);
    if (colorRole(g.color) === 'neutral') neutral += 1;
    for (const s of g.styles || []) styleTally[s] = (styleTally[s] || 0) + 1;
  }
  const total = Object.values(styleTally).reduce((a, b) => a + b, 0) || 1;
  const main = garments.filter((g) => g.category !== 'accessory');
  return {
    signals: raw.signals,
    confidence: Math.round(model.confidence * 100),
    loves: phrases(raw.likes),
    avoids: phrases(raw.dislikes),
    palette: [...palette.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    archetypes: Object.entries(styleTally).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ id, label: ARCHETYPES[id]?.label ?? id, share: Math.round((n / total) * 100) })),
    closet: {
      pieces: main.length,
      neutralShare: main.length ? Math.round((neutral / main.length) * 100) : 0,
      neverWorn: main.filter((g) => !g.wearCount).length
    }
  };
}
