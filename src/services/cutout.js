/**
 * Optional high-accuracy background removal via remove.bg, for photos the in-browser method
 * cannot separate (busy backgrounds). Pro only. Enabled by REMOVEBG_API_KEY.
 */
import { decodeDataUrl, sniffImage } from './images.js';
import { HttpError, unavailable } from '../util/errors.js';

/**
 * @param {import('../config.js').Config} config
 * @param {ReturnType<import('./usage.js').createUsage>} usage
 * @param {{warn:Function}} log
 * @param {typeof fetch} [doFetch]
 */
export function createCutoutService(config, usage, log, doFetch = globalThis.fetch) {
  if (!config.cutout.apiKey) return null;
  return {
    /** @returns {Promise<string>} PNG data URL */
    async remove(user, imageDataUrl) {
      const { data } = decodeDataUrl(imageDataUrl);
      usage.reserve(user.id, 'cutout', { perUser: config.cutout.dailyLimitPerUser, global: 5000 });
      const form = new FormData();
      form.set('image_file_b64', data.toString('base64'));
      form.set('size', config.cutout.size);
      form.set('format', 'png');
      form.set('crop', 'true');
      form.set('crop_margin', '5%');
      let res;
      try {
        res = await doFetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': config.cutout.apiKey }, body: form, signal: AbortSignal.timeout(25_000) });
      } catch (e) {
        log.warn('cutout.network', { message: e.message });
        throw unavailable('Background removal is temporarily unavailable. Your original photo still works.');
      }
      if (!res.ok) {
        let detail = '';
        try {
          detail = (await res.json()).errors?.[0]?.title ?? '';
        } catch {
          /* non-JSON error body */
        }
        log.warn('cutout.rejected', { status: res.status, detail });
        if (res.status === 402) throw unavailable('Background removal is temporarily unavailable. Your original photo still works.');
        throw new HttpError(422, 'cutout_failed', 'We could not separate the garment from that photo.');
      }
      const out = Buffer.from(await res.arrayBuffer());
      const info = sniffImage(out);
      if (!info || info.ext !== 'png' || out.length > 3 * 1024 * 1024) throw new HttpError(502, 'cutout_failed', 'Background removal returned an unexpected result.');
      return `data:image/png;base64,${out.toString('base64')}`;
    }
  };
}
