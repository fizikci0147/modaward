import crypto from 'node:crypto';
import { now } from '../db/index.js';
import { badRequest, notFound, conflict } from '../util/errors.js';

const DAY = 86400;
// no 0/O/1/I so codes survive being read aloud or typed from a screenshot
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizeCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function generate() {
  const pick = (n) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

/**
 * Comped Pro access: operator-made codes and direct grants. Access is time-limited
 * (plan_status = 'granted'); it ends by itself, and a real Stripe subscription always wins.
 */
export function createCodes({ db, repos }) {
  /** Add `days` to whatever comped time the user still has. Paid subscribers keep their subscription. */
  function extend(user, days) {
    if (user.plan === 'pro' && user.plan_status !== 'granted') throw conflict('You already have an active Pro subscription.');
    const base = user.plan === 'pro' && user.plan_renews_at > now() ? user.plan_renews_at : now();
    const until = base + days * DAY;
    repos.users.setPlan(user.id, { plan: 'pro', status: 'granted', renewsAt: until });
    return until;
  }

  return {
    create({ code, days, maxUses = 1, expiresInDays = null, note = '' }) {
      const value = code ? normalizeCode(code) : normalizeCode(generate());
      if (value.length < 4) throw badRequest('A code needs at least 4 letters or numbers.');
      const pretty = code ? value : value.replace(/(.{4})(?=.)/g, '$1-');
      if (db.get('SELECT 1 AS x FROM pro_codes WHERE code = ?', value)) throw conflict('That code already exists.');
      db.run('INSERT INTO pro_codes (code,days,max_uses,note,expires_at,created_at) VALUES (?,?,?,?,?,?)', value, days, maxUses, String(note).slice(0, 200), expiresInDays ? now() + expiresInDays * DAY : null, now());
      return { code: value, display: pretty, days, maxUses };
    },
    list: () => db.all('SELECT code, days, max_uses AS maxUses, uses, note, expires_at AS expiresAt, created_at AS createdAt FROM pro_codes ORDER BY created_at DESC LIMIT 200'),
    remove(code) {
      if (!db.run('DELETE FROM pro_codes WHERE code = ?', normalizeCode(code)).changes) throw notFound('No such code.');
    },
    redeem(user, input) {
      const code = normalizeCode(input);
      return db.transaction(() => {
        const row = db.get('SELECT * FROM pro_codes WHERE code = ?', code);
        // one message for unknown / expired / used up: no way to probe which codes exist
        const invalid = badRequest('That code is not valid. Check it and try again.');
        if (!row || (row.expires_at && row.expires_at < now()) || row.uses >= row.max_uses) throw invalid;
        if (db.get('SELECT 1 AS x FROM pro_redemptions WHERE code = ? AND user_id = ?', code, user.id)) throw badRequest('You have already used this code.');
        const until = extend(user, row.days);
        db.run('INSERT INTO pro_redemptions (code,user_id,redeemed_at) VALUES (?,?,?)', code, user.id, now());
        db.run('UPDATE pro_codes SET uses = uses + 1 WHERE code = ?', code);
        return { days: row.days, until };
      });
    },
    grant(email, days) {
      const user = repos.users.byEmail(String(email).trim().toLowerCase());
      if (!user) throw notFound('No account uses that email yet. Ask them to sign up first, or send them a code instead.');
      return { email: user.email, until: extend(user, days) };
    },
    sweep: () => db.run("UPDATE users SET plan = 'free', plan_status = NULL, plan_renews_at = NULL WHERE plan = 'pro' AND plan_status = 'granted' AND plan_renews_at <= ?", now()).changes
  };
}
