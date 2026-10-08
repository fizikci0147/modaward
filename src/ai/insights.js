/** "Your style DNA": what the taste model has learned and what the closet says, in plain words. */
import { ARCHETYPES, TYPES } from '../shared/taxonomy.js';
import { TasteModel } from './taste.js';
import { colorRole } from '../shared/color.js';
import { ARCHETYPE_WORD } from '../shared/taxonomy.js';
import { L, createTranslator } from '../shared/i18n.js';

const ENGLISH = createTranslator('en');
const PATTERN_WORD = { striped: L('stripes'), checked: L('checks'), floral: L('floral'), graphic: L('graphic'), animal: L('animal'), dotted: L('dotted'), textured: L('textured'), solid: L('solid') };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Turn a feature key into a phrase a person would say. */
export function humanize(feature, t = ENGLISH.t) {
  const [kind, rest] = [feature.slice(0, feature.indexOf(':')), feature.slice(feature.indexOf(':') + 1)];
  switch (kind) {
    case 'type': return TYPES[rest] ? t(TYPES[rest].label).toLowerCase() : rest;
    case 'color': return t(rest);
    case 'pattern': return t(PATTERN_WORD[rest] ?? rest);
    case 'brand': return cap(rest);
    case 'style': return t('{style} style', { style: t(ARCHETYPE_WORD[rest] ?? rest) });
    case 'pair': { const [a, b] = rest.split('+').map((id) => (TYPES[id] ? t(TYPES[id].label).toLowerCase() : id)); return b === undefined ? a : t('{a} with {b}', { a, b }); }
    case 'cpair': { const [a, b] = rest.split('+').map((c) => t(c)); return b === undefined ? a : t('{a} with {b}', { a, b }); }
    default: return null;
  }
}

export function buildInsights({ tasteState, garments, t = ENGLISH.t }) {
  const model = new TasteModel(tasteState);
  const raw = model.insights(10);
  const phrases = (list) => [...new Set(list.map((x) => humanize(x.feature, t)).filter(Boolean))].slice(0, 5);

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
    archetypes: Object.entries(styleTally).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ id, label: ARCHETYPES[id] ? t(ARCHETYPES[id].label) : id, share: Math.round((n / total) * 100) })),
    closet: {
      pieces: main.length,
      neutralShare: main.length ? Math.round((neutral / main.length) * 100) : 0,
      neverWorn: main.filter((g) => !g.wearCount).length
    }
  };
}
