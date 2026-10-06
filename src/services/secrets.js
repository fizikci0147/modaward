import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A stable random secret, generated once and stored in the data directory (mode 0600).
 * An environment value always wins, so multi-instance deployments can share one.
 */
export function persistentSecret(dataDir, name, fromEnv = '') {
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  const dir = path.join(dataDir, 'secrets');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${name}.key`);
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(file, secret, { mode: 0o600, flag: 'wx' });
    return secret;
  } catch (e) {
    if (e.code === 'EEXIST') return fs.readFileSync(file, 'utf8').trim(); // lost a race with another process
    throw e;
  }
}

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export const hmac = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('base64url');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
