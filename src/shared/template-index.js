/**
 * The catalogue-look template list (public/templates/index.json): which garment photographs are available to colour
 * and pattern. Shared by the browser (to show the picker), the tooling that adds templates and the checks.
 */
import { TYPE_IDS, TYPES } from './taxonomy.js';

export const TEMPLATE_DIR = 'templates';
export const SLUG_RE = /^[a-z][a-z0-9-]{1,40}$/;

/**
 * `credit` says where the photograph came from, so its licence can be honoured and checked: the source page, who made
 * it and the licence (for your own photos, author and licence can simply say so).
 * @typedef {{source: string, author: string, license: string, licenseUrl?: string}} TemplateCredit
 * @typedef {{id: string, type: string, label: string, widthCm: number, tags?: string[], credit?: TemplateCredit}} TemplateEntry
 */

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
  if (e.credit !== undefined) p.push(...creditProblems(e.credit));
  return p;
}

const text = (v, max = 200) => typeof v === 'string' && v.trim().length >= 2 && v.length <= max;
const link = (v) => typeof v === 'string' && /^https:\/\/\S+$/.test(v);

/** Problems with a template's credit: where the photograph came from, who made it and under which licence. */
export function creditProblems(c) {
  if (!c || typeof c !== 'object') return ['credit must say source, author and license'];
  const p = [];
  if (!text(c.source, 400)) p.push('credit.source must say where the photo came from (a web address, or "own photo")');
  else if (/^http/i.test(c.source) && !link(c.source)) p.push('credit.source must be an https address');
  if (!text(c.author)) p.push('credit.author must name who made the photo');
  if (!text(c.license, 80)) p.push('credit.license must name the licence');
  if (c.licenseUrl !== undefined && !link(c.licenseUrl)) p.push('credit.licenseUrl must be an https address');
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
