/**
 * Daily usage counters for metered, paid-per-call features (AI stylist, vision tagging,
 * background-removal API). Caps stop a single user, or a bug, from running up a bill.
 */
import { tooMany } from '../util/errors.js';

const today = () => new Date().toISOString().slice(0, 10);

/** @param {import('../db/index.js').Db} db */
export function createUsage(db) {
  const userCalls = (userId, day) => db.get('SELECT COALESCE(SUM(calls),0) AS n FROM ai_usage WHERE user_id = ? AND day = ?', userId, day).n;
  const globalCalls = (day) => db.get('SELECT COALESCE(SUM(calls),0) AS n FROM ai_usage WHERE day = ?', day).n;

  return {
    /**
     * Reserve one call or throw a friendly 429. Counted before the call so failures still count
     * (a provider error should not become a free retry loop).
     */
    reserve(userId, kind, { perUser, global = Infinity }) {
      const day = today();
      if (userCalls(userId, day) >= perUser) throw tooMany('You have used today’s allowance for this feature. It resets tomorrow.');
      if (globalCalls(day) >= global) throw tooMany('This feature is very busy right now. Please try again later.');
      db.run(
        `INSERT INTO ai_usage (user_id, day, kind, calls) VALUES (?,?,?,1)
         ON CONFLICT(user_id, day, kind) DO UPDATE SET calls = calls + 1`,
        userId, day, kind
      );
    },
    record(userId, kind, { input = 0, output = 0 }) {
      db.run('UPDATE ai_usage SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ? WHERE user_id = ? AND day = ? AND kind = ?', input, output, userId, today(), kind);
    },
    today: (userId) => userCalls(userId, today()),
    totals(day = today()) {
      return db.all('SELECT kind, SUM(calls) AS calls, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens FROM ai_usage WHERE day = ? GROUP BY kind', day);
    }
  };
}
