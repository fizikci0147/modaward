import { outfitMarkup } from '/js/art.js';
import { toArtItem } from '/js/components/art.js';
import { t, getLocale } from '/js/i18n.js';
import { describeCode } from '/shared/weather-codes.js';
import { tempStr, longDate } from '/js/format.js';

const W = 1080;
const H = 1350;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** An SVG drawn as an image cannot fetch files, so cut-out photos are embedded as data URLs first. */
async function inlineImages(markup) {
  const urls = [...new Set([...markup.matchAll(/href="(\/uploads\/[^"]+)"/g)].map((m) => m[1]))];
  let out = markup;
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) continue;
      out = out.split(`href="${url}"`).join(`href="${await blobToDataUrl(await res.blob())}"`);
    } catch {
      /* the illustration stays as a fallback */
    }
  }
  return out;
}

/** The poster SVG: the outfit board with the day's weather underneath, in the app's own colours. */
export async function outfitPosterSvg({ items, weather, date, units, headline }) {
  const board = await inlineImages(outfitMarkup(items.map(toArtItem)));
  const cond = weather ? describeCode(weather.code) : null;
  const range = weather ? `${tempStr(weather.tMinC, units)} – ${tempStr(weather.tMaxC, units)}${cond ? ` · ${t(cond.label)}` : ''}` : '';
  let names = items.map((i) => i.name).join(' · ');
  if (names.length > 58) names = `${names.slice(0, 57).replace(/[\s·]+\S*$/, '')}…`;
  const serif = `'Instrument Serif', 'Iowan Old Style', Georgia, 'Times New Roman', serif`;
  const sans = `Geist, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f6f3ed"/>
    <rect x="60" y="60" width="${W - 120}" height="900" rx="40" fill="#ece7dc"/>
    <svg x="150" y="100" width="780" height="820" viewBox="0 0 300 360" preserveAspectRatio="xMidYMid meet">${board}</svg>
    <text x="60" y="1060" font-family="${serif}" font-size="76" fill="#161511">${esc(headline)}</text>
    <text x="60" y="1118" font-family="${sans}" font-size="32" fill="#57534a">${esc(date ? longDate(date) : '')}${range ? ` · ${esc(range)}` : ''}</text>
    <text x="60" y="1180" font-family="${sans}" font-size="28" fill="#8a8578">${esc(names)}</text>
    <g transform="translate(60 1256)"><rect width="56" height="56" rx="14" fill="#1f3d33"/><g transform="translate(8 7) scale(1.3)" fill="none"><path d="M16 10.2V8.6a2.9 2.9 0 1 0-2.9-2.9" stroke="#f6f3ed" stroke-width="2.1" stroke-linecap="round"/><path d="M16 10.2 4.6 19.2a2.1 2.1 0 0 0 1.3 3.8h20.2a2.1 2.1 0 0 0 1.3-3.8L16 10.2Z" stroke="#f6f3ed" stroke-width="2.1" stroke-linejoin="round"/></g></g>
    <text x="136" y="1296" font-family="${serif}" font-size="48" fill="#161511">ModaWard</text>
  </svg>`;
}

async function svgToPng(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('render'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d').drawImage(img, 0, 0, W, H);
    return await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Turn an outfit into a picture and hand it to the phone's share sheet, or download it where
 * sharing files is not supported.
 * @returns {Promise<'shared'|'saved'|'cancelled'>}
 */
export async function shareOutfit({ outfit, weather, date, units }) {
  const headline = t('Today’s look');
  const svg = await outfitPosterSvg({ items: outfit.items, weather, date, units, headline });
  const blob = await svgToPng(svg);
  const file = new File([blob], 'modaward-outfit.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'ModaWard', text: t('My outfit for today, picked by ModaWard') });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `modaward-outfit-${date || 'today'}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}

export { getLocale };
