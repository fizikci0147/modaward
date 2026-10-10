/**
 * Data access. All SQL lives here so route handlers stay free of it and every query is
 * parameterised and scoped by user id (no handler can read another person's data by mistake).
 */
import crypto from 'node:crypto';
import { now } from '../db/index.js';
import { sha256, randomToken } from '../services/secrets.js';
import { colorName } from '../shared/color.js';
import { withDefaults } from '../shared/taxonomy.js';
import { DEFAULT_PROFILE, mergeProfile } from '../shared/profile.js';

export { DEFAULT_PROFILE };

const uuid = () => crypto.randomUUID();
const parse = (json, fallback) => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const publicUser = (u) =>
  u && {
    id: u.id,
    email: u.email,
    name: u.name,
    plan: u.plan,
    planStatus: u.plan_status,
    planRenewsAt: u.plan_renews_at,
    createdAt: u.created_at
  };

/** Row → API/engine garment. */
export function garmentFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    type: r.type,
    color: r.color,
    colorName: colorName(r.color),
    pattern: r.pattern,
    warmth: r.warmth,
    formality: r.formality,
    waterproof: Boolean(r.waterproof),
    brand: r.brand,
    styles: parse(r.styles, []),
    notes: r.notes,
    imageUrl: r.image_path ? `/uploads/${r.image_path}?v=${r.updated_at}` : null,
    priceCents: r.price_cents ?? null,
    favorite: Boolean(r.favorite),
    archived: Boolean(r.archived),
    excluded: Boolean(r.excluded),
    wearCount: r.wear_count ?? 0,
    lastWornOn: r.last_worn ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

const GARMENT_SELECT = `
  SELECT g.*,
    (SELECT COUNT(*) FROM wear_log w WHERE w.garment_id = g.id) AS wear_count,
    (SELECT MAX(worn_on) FROM wear_log w WHERE w.garment_id = g.id) AS last_worn
  FROM garments g`;

/** @param {import('../db/index.js').Db} db */
export function createRepos(db) {
  const users = {
    create({ email, passwordHash, name = '', termsVersion = null }) {
      const id = uuid();
      db.transaction(() => {
        db.run('INSERT INTO users (id,email,password_hash,name,created_at,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?,?)', id, email, passwordHash, name, now(), termsVersion, termsVersion ? now() : null);
        db.run('INSERT INTO profiles (user_id,data,taste,updated_at) VALUES (?,?,?,?)', id, JSON.stringify(DEFAULT_PROFILE), '{}', now());
      });
      return users.byId(id);
    },
    byId: (id) => db.get('SELECT * FROM users WHERE id = ?', id),
    acceptTerms: (id, version) => db.run('UPDATE users SET terms_version = ?, terms_accepted_at = ? WHERE id = ?', version, now(), id),
    byEmail: (email) => db.get('SELECT * FROM users WHERE email = ?', email),
    byStripeCustomer: (customerId) => db.get('SELECT * FROM users WHERE stripe_customer_id = ?', customerId),
    setPassword: (id, hash) => db.run('UPDATE users SET password_hash = ? WHERE id = ?', hash, id),
    setName: (id, name) => db.run('UPDATE users SET name = ? WHERE id = ?', name, id),
    touch: (id) => db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', now(), id),
    /** Mark this person active in the current hour (one cheap row per person per hour). */
    recordActivity: (id) => db.run('INSERT OR IGNORE INTO user_activity (user_id, hour) VALUES (?, ?)', id, Math.floor(now() / 3600)),
    purgeActivity: (days = 400) => db.run('DELETE FROM user_activity WHERE hour < ?', Math.floor(now() / 3600) - days * 24).changes,
    remove: (id) => db.run('DELETE FROM users WHERE id = ?', id),
    setPlan(id, { plan, status, renewsAt, customerId, subscriptionId }) {
      db.run(
        `UPDATE users SET plan = ?, plan_status = ?, plan_renews_at = ?,
           stripe_customer_id = COALESCE(?, stripe_customer_id),
           stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?`,
        plan,
        status ?? null,
        renewsAt ?? null,
        customerId ?? null,
        subscriptionId ?? null,
        id
      );
    },
    count: () => db.get('SELECT COUNT(*) AS n FROM users').n
  };

  const sessions = {
    /** @returns {string} the raw token (only ever stored hashed) */
    create(userId, userAgent = '', days = 30) {
      const token = randomToken(32);
      db.run('INSERT INTO sessions (token_hash,user_id,created_at,expires_at,user_agent) VALUES (?,?,?,?,?)', sha256(token), userId, now(), now() + days * 86400, String(userAgent).slice(0, 200));
      return token;
    },
    resolve(token) {
      if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
      const row = db.get(
        `SELECT u.*, s.expires_at AS session_expires
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
        sha256(token),
        now()
      );
      if (row && row.plan === 'pro' && row.plan_status === 'granted' && row.plan_renews_at <= now()) {
        // comped Pro time has run out: back to Free, effective on this very request
        users.setPlan(row.id, { plan: 'free', status: null, renewsAt: null });
        Object.assign(row, { plan: 'free', plan_status: null, plan_renews_at: null });
      }
      return row || null;
    },
    revoke: (token) => db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token || '')),
    revokeAll: (userId, exceptToken) =>
      db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', userId, exceptToken ? sha256(exceptToken) : ''),
    purgeExpired: () => db.run('DELETE FROM sessions WHERE expires_at <= ?', now()).changes
  };

  const resets = {
    create(userId) {
      const token = randomToken(32);
      db.run('DELETE FROM password_resets WHERE user_id = ?', userId);
      db.run('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,?)', sha256(token), userId, now() + 3600);
      return token;
    },
    /** Single use: returns the user id once, then the token is dead. */
    consume(token) {
      if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
      return db.transaction(() => {
        const row = db.get('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', sha256(token), now());
        if (!row) return null;
        db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', now(), row.token_hash);
        return row.user_id;
      });
    }
  };

  const profiles = {
    get(userId) {
      const row = db.get('SELECT data, taste FROM profiles WHERE user_id = ?', userId);
      return mergeProfile(DEFAULT_PROFILE, parse(row?.data, {}));
    },
    save(userId, profile) {
      db.run('UPDATE profiles SET data = ?, updated_at = ? WHERE user_id = ?', JSON.stringify(profile), now(), userId);
    },
    getTaste: (userId) => parse(db.get('SELECT taste FROM profiles WHERE user_id = ?', userId)?.taste, {}),
    saveTaste: (userId, taste) => db.run('UPDATE profiles SET taste = ? WHERE user_id = ?', JSON.stringify(taste), userId)
  };

  const garments = {
    list(userId, { includeArchived = false } = {}) {
      const rows = db.all(`${GARMENT_SELECT} WHERE g.user_id = ? ${includeArchived ? '' : 'AND g.archived = 0'} ORDER BY g.created_at DESC, g.id`, userId);
      return rows.map(garmentFromRow);
    },
    get(userId, id) {
      const row = db.get(`${GARMENT_SELECT} WHERE g.user_id = ? AND g.id = ?`, userId, id);
      return row ? garmentFromRow(row) : null;
    },
    count: (userId) => db.get('SELECT COUNT(*) AS n FROM garments WHERE user_id = ? AND archived = 0', userId).n,
    countAll: (userId) => db.get('SELECT COUNT(*) AS n FROM garments WHERE user_id = ?', userId).n,
    /** @param {object} g validated input (type, color, name …) */
    create(userId, g) {
      const full = withDefaults(g);
      const id = uuid();
      const t = now();
      db.run(
        `INSERT INTO garments (id,user_id,name,category,type,color,pattern,warmth,formality,waterproof,brand,styles,notes,image_path,favorite,archived,price_cents,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, userId, full.name, full.category, full.type, full.color, full.pattern ?? 'solid', full.warmth, full.formality,
        full.waterproof, full.brand ?? '', JSON.stringify(full.styles ?? []), full.notes ?? '', full.imageName ?? null, full.favorite ?? false, false, full.priceCents ?? null, t, t
      );
      return garments.get(userId, id);
    },
    update(userId, id, patch) {
      const cur = garments.get(userId, id);
      if (!cur) return null;
      const merged = { ...cur, ...patch };
      if (patch.type && patch.type !== cur.type) {
        // a new type brings its own sensible warmth/formality unless the caller set them explicitly
        for (const key of ['warmth', 'formality', 'waterproof', 'styles']) if (!(key in patch)) merged[key] = undefined;
      }
      const next = withDefaults(merged);
      db.run(
        `UPDATE garments SET name=?, category=?, type=?, color=?, pattern=?, warmth=?, formality=?, waterproof=?, brand=?, styles=?, notes=?, favorite=?, archived=?, excluded=?, price_cents=?, updated_at=?
         WHERE id=? AND user_id=?`,
        next.name, next.category, next.type, next.color, next.pattern, next.warmth, next.formality, next.waterproof, next.brand,
        JSON.stringify(next.styles ?? []), next.notes, next.favorite, next.archived, next.excluded ?? false, next.priceCents ?? null, now(), id, userId
      );
      return garments.get(userId, id);
    },
    imageName(userId, id) {
      return db.get('SELECT image_path FROM garments WHERE id = ? AND user_id = ?', id, userId)?.image_path ?? null;
    },
    setImage(userId, id, name) {
      db.run('UPDATE garments SET image_path = ?, updated_at = ? WHERE id = ? AND user_id = ?', name, now(), id, userId);
    },
    /** @returns {string|null} stored image name to delete from disk */
    remove(userId, id) {
      const image = garments.imageName(userId, id);
      const { changes } = db.run('DELETE FROM garments WHERE id = ? AND user_id = ?', id, userId);
      return changes ? image ?? '' : null;
    },
    ownedIds(userId, ids) {
      if (!ids.length) return [];
      const marks = ids.map(() => '?').join(',');
      return db.all(`SELECT id FROM garments WHERE user_id = ? AND id IN (${marks})`, userId, ...ids).map((r) => r.id);
    },
    /** Bring back every piece the person marked "never suggest". */
    clearExcluded: (userId) => db.run('UPDATE garments SET excluded = 0 WHERE user_id = ? AND excluded = 1', userId).changes,
    allImageNames: (userId) => db.all('SELECT image_path FROM garments WHERE user_id = ? AND image_path IS NOT NULL', userId).map((r) => r.image_path),
    ownsImage: (userId, name) => Boolean(db.get('SELECT 1 AS ok FROM garments WHERE user_id = ? AND image_path = ?', userId, name))
  };

  const wear = {
    /**
     * Record what was worn on a day. A whole outfit replaces any earlier outfit logged for that
     * date (people change their mind), but never the single-piece entries made from the closet.
     * @returns {boolean} false when this exact outfit was already logged for the day
     */
    log(userId, { garmentIds, date, outfitKey, occasion }) {
      let changed = true;
      db.transaction(() => {
        if (!outfitKey.startsWith('piece:')) {
          const existing = db.all("SELECT garment_id FROM wear_log WHERE user_id = ? AND worn_on = ? AND outfit_key NOT LIKE 'piece:%'", userId, date).map((r) => r.garment_id);
          changed = existing.length !== garmentIds.length || garmentIds.some((g) => !existing.includes(g));
          if (existing.length) db.run("DELETE FROM wear_log WHERE user_id = ? AND worn_on = ? AND outfit_key NOT LIKE 'piece:%'", userId, date);
        }
        for (const gid of garmentIds) {
          db.run(
            `INSERT INTO wear_log (user_id,garment_id,worn_on,outfit_key,occasion,created_at) VALUES (?,?,?,?,?,?)
             ON CONFLICT(user_id,garment_id,worn_on) DO UPDATE SET outfit_key = excluded.outfit_key, occasion = excluded.occasion`,
            userId, gid, date, outfitKey, occasion ?? null, now()
          );
        }
      });
      return changed;
    },
    /** Remove one piece's wear entry for a date (the piece-level "I wore it" undo). */
    unlogOne: (userId, garmentId, date) => db.run('DELETE FROM wear_log WHERE user_id = ? AND garment_id = ? AND worn_on = ?', userId, garmentId, date).changes,
    /** Undo "I wore this outfit" for a date, leaving single-piece entries alone. */
    unlog: (userId, date) => db.run("DELETE FROM wear_log WHERE user_id = ? AND worn_on = ? AND outfit_key NOT LIKE 'piece:%'", userId, date).changes,
    /** Freshness inputs for the engine, relative to `today`. */
    history(userId, today) {
      const rows = db.all('SELECT garment_id, worn_on, outfit_key FROM wear_log WHERE user_id = ? AND worn_on >= date(?, \'-30 day\') AND worn_on <= ?', userId, today, today);
      const lastWorn = {};
      const recentKeys = new Set();
      for (const r of rows) {
        const ago = daysBetween(r.worn_on, today);
        if (lastWorn[r.garment_id] === undefined || ago < lastWorn[r.garment_id]) lastWorn[r.garment_id] = ago;
        if (ago <= 14) recentKeys.add(r.outfit_key);
      }
      return { lastWorn, recentKeys: [...recentKeys] };
    },
    /** How many times each piece was worn in the last `days` days. @returns {Map<string, number>} */
    countsSince(userId, days, today) {
      const rows = db.all("SELECT garment_id, COUNT(*) AS n FROM wear_log WHERE user_id = ? AND worn_on > date(?, ?) AND worn_on <= ? GROUP BY garment_id", userId, today, `-${days} day`, today);
      return new Map(rows.map((r) => [r.garment_id, r.n]));
    },
    recent(userId, days = 30) {
      const rows = db.all(
        `SELECT worn_on, outfit_key, occasion, GROUP_CONCAT(garment_id) AS ids FROM wear_log
         WHERE user_id = ? AND worn_on >= date('now', ?) GROUP BY worn_on, outfit_key ORDER BY worn_on DESC`,
        userId, `-${days} day`
      );
      return rows.map((r) => ({ date: r.worn_on, key: r.outfit_key, occasion: r.occasion, garmentIds: r.ids.split(',') }));
    }
  };

  const plans = {
    list: (userId, from, to) => db.all('SELECT date, occasion, note FROM day_plans WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date', userId, from, to),
    get: (userId, date) => db.get('SELECT date, occasion, note FROM day_plans WHERE user_id = ? AND date = ?', userId, date) ?? null,
    set(userId, date, { occasion, note = '' }) {
      db.run(
        `INSERT INTO day_plans (user_id, date, occasion, note, updated_at) VALUES (?,?,?,?,?)
         ON CONFLICT(user_id, date) DO UPDATE SET occasion = excluded.occasion, note = excluded.note, updated_at = excluded.updated_at`,
        userId, date, occasion, note, now()
      );
    },
    remove: (userId, date) => db.run('DELETE FROM day_plans WHERE user_id = ? AND date = ?', userId, date).changes,
    purgeBefore: (date) => db.run('DELETE FROM day_plans WHERE date < ?', date).changes
  };

  const feedback = {
    add: (userId, kind, key, signal) => db.run('INSERT INTO feedback (user_id,kind,target_key,signal,created_at) VALUES (?,?,?,?,?)', userId, kind, key, signal, now()),
    /** Outfits the person explicitly rejected: never show them again. */
    blockedKeys: (userId) => new Set(db.all("SELECT DISTINCT target_key FROM feedback WHERE user_id = ? AND kind = 'outfit' AND signal = 'dislike'", userId).map((r) => r.target_key)),
    blockedLooks: (userId) => new Set(db.all("SELECT DISTINCT target_key FROM feedback WHERE user_id = ? AND kind = 'look' AND signal = 'dislike'", userId).map((r) => r.target_key)),
    count: (userId) => db.get('SELECT COUNT(*) AS n FROM feedback WHERE user_id = ?', userId).n,
    clear: (userId) => db.run('DELETE FROM feedback WHERE user_id = ?', userId).changes
  };

  /** Pairs of pieces the person said do not go together. Stored once per pair, smaller id first. */
  const pairs = {
    add(userId, pieceId, withIds) {
      db.transaction(() => {
        for (const other of withIds) {
          if (other === pieceId) continue;
          const [a, b] = pieceId < other ? [pieceId, other] : [other, pieceId];
          db.run('INSERT OR IGNORE INTO pair_blocks (user_id,a,b,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM garments WHERE user_id = ? AND id IN (?,?)) = 2', userId, a, b, now(), userId, a, b);
        }
      });
    },
    remove(userId, pieceId, withIds) {
      for (const other of withIds) {
        const [a, b] = pieceId < other ? [pieceId, other] : [other, pieceId];
        db.run('DELETE FROM pair_blocks WHERE user_id = ? AND a = ? AND b = ?', userId, a, b);
      }
    },
    /** @returns {Set<string>} "a|b" keys, smaller id first */
    set: (userId) => new Set(db.all('SELECT a, b FROM pair_blocks WHERE user_id = ?', userId).map((r) => `${r.a}|${r.b}`)),
    count: (userId) => db.get('SELECT COUNT(*) AS n FROM pair_blocks WHERE user_id = ?', userId).n,
    clear: (userId) => db.run('DELETE FROM pair_blocks WHERE user_id = ?', userId).changes
  };

  const looks = {
    remember(userId, id, payload) {
      db.run('INSERT OR REPLACE INTO looks (id,user_id,payload,created_at) VALUES (?,?,?,?)', id, userId, JSON.stringify(payload), now());
      db.run('DELETE FROM looks WHERE user_id = ? AND created_at < ?', userId, now() - 14 * 86400);
    },
    get(userId, id) {
      const row = db.get('SELECT payload FROM looks WHERE id = ? AND user_id = ?', id, userId);
      return row ? parse(row.payload, null) : null;
    }
  };

  const saved = {
    add(userId, kind, payload) {
      const id = uuid();
      db.run('INSERT INTO saved_looks (id,user_id,kind,payload,created_at) VALUES (?,?,?,?,?)', id, userId, kind, JSON.stringify(payload), now());
      return id;
    },
    list: (userId) =>
      db.all('SELECT * FROM saved_looks WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', userId).map((r) => {
        const payload = parse(r.payload, {});
        // the saved-item id must win over the look's own id
        return { ...payload, lookId: payload.id, id: r.id, kind: r.kind, createdAt: r.created_at };
      }),
    remove: (userId, id) => db.run('DELETE FROM saved_looks WHERE id = ? AND user_id = ?', id, userId).changes > 0,
    count: (userId) => db.get('SELECT COUNT(*) AS n FROM saved_looks WHERE user_id = ?', userId).n
  };

  return { users, sessions, resets, profiles, garments, wear, plans, feedback, pairs, looks, saved, db };
}
