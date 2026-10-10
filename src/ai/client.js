/**
 * Thin, defensive wrapper around the Anthropic SDK.
 *
 * Every call: reserves a slice of the daily budget first, asks for schema-constrained JSON, treats
 * refusals/truncation/errors as "no answer" (callers fall back to the deterministic engine), and
 * never throws provider details at the user. AI is an enhancement here, never a dependency.
 */
import { unavailable } from '../util/errors.js';

/**
 * @param {import('../config.js').Config} config
 * @param {ReturnType<import('../services/usage.js').createUsage>} usage
 * @param {{info:Function, warn:Function, error:Function}} log
 * @param {object} [injectedClient]  an object shaped like `new Anthropic()`; used by tests
 */
export async function createAiClient(config, usage, log, injectedClient) {
  if (!config.ai.apiKey && !injectedClient) return null;
  let client = injectedClient;
  if (!client) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: config.ai.apiKey, timeout: 45_000, maxRetries: 1 });
  }

  return {
    model: config.ai.model,
    /** the SDK client itself, for the few callers that need a server tool (the trend refresh) */
    raw: client,

    /**
     * Ask for a JSON document matching `schema`.
     * @returns {Promise<object|null>} parsed JSON, or null if the model declined/was cut off/errored
     */
    async askJson({ user, kind, system, content, schema, effort = 'low', maxTokens = 4000 }) {
      usage.reserve(user.id, kind, { perUser: config.ai.dailyLimitPerUser, global: config.ai.dailyLimitGlobal });
      let response;
      try {
        response = await client.beta.messages.create({
          model: config.ai.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content }],
          output_config: { effort, format: { type: 'json_schema', schema } },
          // if a safety classifier declines, retry once on the model Anthropic recommends
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default'
        });
      } catch (e) {
        log.warn('ai.request_failed', { kind, status: e?.status, name: e?.name, message: String(e?.message || '').slice(0, 200) });
        return null;
      }
      usage.record(user.id, kind, { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 });
      if (response.stop_reason === 'refusal') {
        log.info('ai.refusal', { kind, category: response.stop_details?.category ?? null });
        return null;
      }
      if (response.stop_reason === 'max_tokens') {
        log.warn('ai.truncated', { kind });
        return null;
      }
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      try {
        return JSON.parse(text);
      } catch {
        log.warn('ai.bad_json', { kind });
        return null;
      }
    },

    requireEnabled() {
      return true;
    },
    unavailable: () => unavailable('The AI stylist is not switched on for this site.')
  };
}
