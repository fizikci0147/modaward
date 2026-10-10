/**
 * Web push (the notifications that arrive even when ModaWard is closed).
 *
 * VAPID keys identify this server to the browsers' push services. They come from the environment
 * when set; otherwise they are generated once and kept in the data folder, so push works with no
 * setup. Subscription endpoints are only accepted from the real browser push services, so the
 * server can never be pointed at an arbitrary address.
 */
import fs from 'node:fs';
import path from 'node:path';
import { now } from '../db/index.js';

const PUSH_HOSTS = /^(?:[a-z0-9-]+\.)*(?:fcm\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.microsoft\.com)$/i;

/** True for an https URL on one of the browser vendors' push services. */
export function isPushEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && PUSH_HOSTS.test(u.hostname) && endpoint.length <= 800;
  } catch {
    return false;
  }
}

const MAX_DEVICES = 10;

function loadKeys(config, webpush) {
  if (config.push.publicKey && config.push.privateKey) return { publicKey: config.push.publicKey, privateKey: config.push.privateKey };
  const dir = path.join(config.dataDir, 'secrets');
  const file = path.join(dir, 'vapid.json');
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved.publicKey && saved.privateKey) return saved;
  } catch {
    /* generate below */
  }
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600, flag: 'wx' });
    return keys;
  } catch (e) {
    if (e.code === 'EEXIST') return JSON.parse(fs.readFileSync(file, 'utf8')); // another process won the race
    throw e;
  }
}

/**
 * @param {import('../config.js').Config} config
 * @param {import('../db/index.js').Db} db
 * @param {{warn:Function, info:Function}} log
 * @param {(sub:object, body:string, opts:object)=>Promise<any>} [sender] injected in tests
 */
export async function createPush(config, db, log, sender) {
  if (!config.push.enabled) return null;
  // loaded lazily so a deploy that skipped "npm install" degrades to "no notifications" instead of a 503
  let webpush;
  try {
    webpush = (await import('web-push')).default;
  } catch {
    log.warn('push.unavailable', { detail: 'The web-push package is not installed, so notifications are off. Run npm install.' });
    return null;
  }
  const keys = loadKeys(config, webpush);
  const subject = config.push.subject || (config.appUrl.startsWith('https://') ? config.appUrl : `mailto:${config.adminEmails[0] || 'admin@example.com'}`);
  const options = { vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey } };
  const send = sender || ((sub, body, opts) => webpush.sendNotification(sub, body, { ...opts, ...options }));

  return {
    publicKey: keys.publicKey,

    subscribe(userId, { endpoint, keys: k }, userAgent = '') {
      // a person has a handful of devices: keep the newest ones so the list (and a test send) stays small
      const mine = db.all('SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint <> ? ORDER BY id DESC', userId, endpoint);
      for (const old of mine.slice(MAX_DEVICES - 1)) db.run('DELETE FROM push_subscriptions WHERE id = ?', old.id);
      db.run(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at) VALUES (?,?,?,?,?,?)
         ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, failures = 0`,
        userId, endpoint, k.p256dh, k.auth, String(userAgent).slice(0, 200), now()
      );
    },
    unsubscribe: (userId, endpoint) => db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', userId, endpoint).changes,
    count: (userId) => db.get('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', userId).n,

    /** Send to every device the person has enabled. Dead subscriptions are removed. @returns {Promise<number>} devices reached */
    async notify(userId, payload) {
      const subs = db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', userId);
      let reached = 0;
      for (const s of subs) {
        try {
          await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'normal', timeout: 10_000 });
          reached += 1;
          if (s.failures) db.run('UPDATE push_subscriptions SET failures = 0 WHERE id = ?', s.id);
        } catch (e) {
          const status = e?.statusCode;
          if (status === 404 || status === 410) {
            db.run('DELETE FROM push_subscriptions WHERE id = ?', s.id); // the person revoked it or uninstalled
          } else {
            log.warn('push.failed', { status, message: String(e?.message || '').slice(0, 160) });
            if (s.failures + 1 >= 5) db.run('DELETE FROM push_subscriptions WHERE id = ?', s.id);
            else db.run('UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?', s.id);
          }
        }
      }
      return reached;
    }
  };
}
