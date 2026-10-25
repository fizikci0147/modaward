/**
 * The catalogue-look template list (public/templates/index.json): which garment photographs are available to colour
 * and pattern. Shared by the browser (to show the picker), the tooling that adds templates and the checks.
 */
import { TYPE_IDS, TYPES } from './taxonomy.js';

export const TEMPLATE_DIR = 'templates';
export const SLUG_RE = /^[a-z][a-z0-9-]{1,40}$/;

/** @typedef {{id: string, type: string, label: string, widthCm: number, tags?: string[]}} TemplateEntry */

export const templateFile = (e) => `${TEMPLATE_DIR}/${e.type}/${e.id}.png`;

/** Problems with one entry, as short sentences; an empty list means it is fine. */
export function entryProblems(e) {
  const p = [];
  if (!e || typeof e !== 'object') return ['not an object'];
  if (!SLUG_RE.test(e.id ?? '')) p.push(`id "${e.id}" must be lowercase letters, digits and hyphens`);
  if (!TYPE_IDS.includes(e.type)) p.push(`type "${e.type}" is not a garment type`);
  if (typeof e.label !== 'string' || e.label.length < 2 || e.label.length > 40) p.push('label must be 2 to 40 characters');
  if (!Number.isFinite(e.widthCm) || e.widthCm < 15 || e.widthCm > 160) p.push('widthCm must be between 15 and 160');
  if (e.tags !== undefined && (!Array.isArray(e.tags) || e.tags.some((t) => typeof t !== 'string' || t.length > 24))) p.push('tags must be short words');
  return p;
}

export function indexProblems(index) {
  if (!index || !Array.isArray(index.templates)) return ['index.json needs a "templates" list'];
  const out = [];
  const seen = new Set();
  index.templates.forEach((e, i) => {
    for (const msg of entryProblems(e)) out.push(`#${i + 1} ${e?.id ?? ''}: ${msg}`);
    const key = `${e?.type}/${e?.id}`;
    if (seen.has(key)) out.push(`#${i + 1}: duplicate ${key}`);
    seen.add(key);
  });
  return out;
}

/** The templates for one garment type, in the order listed. */
export const templatesFor = (index, type) => (index?.templates ?? []).filter((e) => e.type === type);

/** Types that have at least one template, and the ones still missing, in the taxonomy's order. */
export function coverage(index) {
  const have = [];
  const missing = [];
  for (const id of TYPE_IDS) {
    const n = templatesFor(index, id).length;
    (n ? have : missing).push({ id, label: TYPES[id].label, category: TYPES[id].category, count: n });
  }
  return { have, missing };
}
