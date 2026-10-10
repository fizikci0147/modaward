/**
 * Keeps the trend lists current. Once a month (and on demand from the admin page) it asks Claude,
 * with web search, what is in style for the current and the next season, then VALIDATES the answer
 * against this app's own vocabulary before using it: nothing the model says is trusted beyond real
 * palette colours, real garment types, known patterns and a small capped weight.
 *
 * The result is saved to DATA_DIR/trends.json (the previous one is kept as trends.previous.json) and
 * applied at once. Without an AI key the built-in lists are used and fade as they age (see
 * trendFreshness in shared/trends.js); the owner can also edit trends.json by hand (docs/TRENDS.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PALETTE } from '../shared/color.js';
import { TYPE_IDS, PATTERNS, ARCHETYPE_IDS } from '../shared/taxonomy.js';
import { configureTrends, sanitizeTrendLists, trendSets } from '../shared/trends.js';

const DAY_MS = 86_400_000;
const REFRESH_EVERY_DAYS = 30;
const VOCAB = { colors: PALETTE.map((p) => p.name), types: TYPE_IDS, patterns: PATTERNS, archetypes: ARCHETYPE_IDS };

const SYSTEM = `You are the fashion-trend analyst for a wardrobe and outfit app. Use web search to find what is genuinely in style RIGHT NOW from reputable fashion sources (runway reports, major retailers' trend reports, fashion magazines), for women's and men's wear.

Answer with ONE JSON object and nothing else:
{ "fw": [Trend, ...], "ss": [Trend, ...], "sources": ["https://..."] }
"fw" is the autumn/winter season and "ss" the spring/summer season, whichever is current or next, 8 to 14 trends each, the most important first.

Trend = { "id": "kebab-case", "label": "short phrase that completes: In step with this season: <label>.", "labels": { "en": "...", "es": "...", "fr": "...", "de": "...", "pt": "...", "it": "...", "tr": "..." }, "weight": 0.015 to 0.045 (how strongly it matters), "archetypes": [styles it suits], "match": Match }

Match is exactly one of:
 { "colors": [colour names], "on": "main" }                      a colour on the main pieces
 { "types": [garment types], "on": "upper" | "main" | "any" }    a garment type
 { "patterns": [pattern ids] }
 { "tonal": "black" | "warm" }                                   head-to-toe in one colour family
 { "all": [Match, Match, ...] }                                  2 to 4 matches that must all hold

Only use these words:
 colours: ${VOCAB.colors.join(', ')}
 garment types: ${VOCAB.types.join(', ')}
 patterns: ${VOCAB.patterns.join(', ')}
 styles (archetypes): ${VOCAB.archetypes.join(', ')}

Describe trends the way a stylist would wear them, not brands or celebrities. Prefer trends that can be expressed with the words above; skip the rest.`;

export function createTrendService({ config, ai, log, now = () => new Date() }) {
  const file = path.join(config.dataDir, 'trends.json');
  const previous = path.join(config.dataDir, 'trends.previous.json');
  let running = false;
  let lastError = null;

  function load() {
    try {
      if (!fs.existsSync(file)) return null;
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      configureTrends(json);
      return json;
    } catch (e) {
      log.warn('trends.invalid', { message: String(e?.message || '').slice(0, 120) });
      return null;
    }
  }

  const saved = () => {
    try {
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    } catch {
      return null;
    }
  };

  /** Ask the model, validate, save, apply. @returns {Promise<{ok:boolean, reason?:string, fw?:number, ss?:number}>} */
  async function refresh() {
    if (!ai?.raw) return { ok: false, why: 'The AI stylist is not switched on (no ANTHROPIC_API_KEY), so trends cannot refresh themselves.' };
    if (running) return { ok: false, why: 'A refresh is already running.' };
    running = true;
    try {
      const today = now().toISOString().slice(0, 10);
      const messages = [{ role: 'user', content: `Today is ${today}. Research current fashion trends and return the JSON.` }];
      let response;
      for (let turn = 0; turn < 4; turn++) {
        response = await ai.raw.messages.create({
          model: config.ai.model,
          max_tokens: 12_000,
          system: SYSTEM,
          tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
          messages
        });
        // a long web search can pause the turn: hand the work back so it continues
        if (response.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: response.content });
      }
      if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') throw new Error(`the model stopped early (${response.stop_reason})`);
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('the answer contained no JSON');
      const parsed = JSON.parse(match[0]);
      const lists = sanitizeTrendLists(parsed, VOCAB);
      if (!lists) throw new Error('too few usable trends came back (need at least 6 for each season)');
      const sources = (Array.isArray(parsed.sources) ? parsed.sources : []).filter((u) => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 12);
      const doc = { updatedAt: now().toISOString(), source: 'auto', model: config.ai.model, sources, ...lists };
      if (fs.existsSync(file)) fs.copyFileSync(file, previous);
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), { mode: 0o600 });
      fs.renameSync(tmp, file);
      configureTrends(doc);
      lastError = null;
      log.info('trends.refreshed', { fw: lists.fw.length, ss: lists.ss.length, sources: sources.length });
      return { ok: true, fw: lists.fw.length, ss: lists.ss.length };
    } catch (e) {
      lastError = { at: now().toISOString(), message: String(e?.message || e).slice(0, 200) };
      log.warn('trends.refresh_failed', { message: lastError.message });
      return { ok: false, why: lastError.message };
    } finally {
      running = false;
    }
  }

  const due = () => {
    const doc = saved();
    const updated = doc?.updatedAt ? Date.parse(doc.updatedAt) : 0;
    return !updated || now().getTime() - updated > REFRESH_EVERY_DAYS * DAY_MS;
  };

  return {
    load,
    refresh,
    due,
    /** Refresh when the saved lists are a month old (called daily). Never throws. */
    async refreshIfDue() {
      if (!config.trends.autoRefresh || !ai?.raw || !due()) return null;
      return refresh();
    },
    /** Drop the saved lists and go back to the built-in ones. */
    restoreBuiltIn() {
      if (fs.existsSync(file)) fs.copyFileSync(file, previous);
      fs.rmSync(file, { force: true });
      configureTrends(null);
    },
    status() {
      const doc = saved();
      const sets = trendSets();
      return {
        updated: sets.updated,
        custom: sets.custom,
        source: doc?.source ?? (doc ? 'manual' : 'built-in'),
        sources: doc?.sources ?? [],
        auto: Boolean(config.trends.autoRefresh && ai?.raw),
        lastError,
        counts: { fw: sets.fw.length, ss: sets.ss.length }
      };
    }
  };
}
