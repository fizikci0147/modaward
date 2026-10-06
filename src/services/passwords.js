/**
 * Password hashing with scrypt. Parameters are stored inside each hash so they can be raised
 * later without invalidating existing accounts (see `needsRehash`).
 *
 * Hash format: scrypt$N$r$p$saltHex$keyHex
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { badRequest } from '../util/errors.js';

const scrypt = promisify(crypto.scrypt);

const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LEN = 64;
const MAX_MEMORY = 128 * 1024 * 1024;

/** At most two hashes in flight: protects small hosts from login-flood memory spikes. */
let active = 0;
const waiting = [];
async function slot() {
  if (active >= 2) await new Promise((resolve) => waiting.push(resolve));
  active += 1;
}
function release() {
  active -= 1;
  waiting.shift()?.();
}

async function derive(password, salt, { N, r, p }) {
  await slot();
  try {
    return await scrypt(password.normalize('NFKC'), salt, KEY_LEN, { N, r, p, maxmem: MAX_MEMORY });
  } finally {
    release();
  }
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('hex'), key.toString('hex')].join('$');
}

/** Constant-time check. A malformed stored hash simply fails. */
export async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltHex, keyHex] = parts;
  const params = { N: Number(N), r: Number(r), p: Number(p) };
  if (!Object.values(params).every(Number.isInteger)) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'), params);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function needsRehash(stored) {
  const parts = String(stored).split('$');
  return parts.length === 6 && (Number(parts[1]) !== PARAMS.N || Number(parts[2]) !== PARAMS.r || Number(parts[3]) !== PARAMS.p);
}

/** Verified against when an email is unknown, so response time does not reveal which emails exist. */
let dummy;
export async function verifyAgainstDummy(password) {
  dummy ??= await hashPassword('timing-equaliser');
  await verifyPassword(password, dummy);
}

const COMMON = new Set(['password', 'password1', 'password123', '1234567890', 'qwertyuiop', 'iloveyou12', 'letmein123', 'welcome123', 'admin12345', '0123456789', 'modaward123', 'passw0rd123']);

/** @throws {HttpError} when the password is too weak */
export function assertStrongPassword(password, email = '') {
  if (typeof password !== 'string') throw badRequest('password: must be text', { field: 'password' });
  if (password.length < 10) throw badRequest('Choose a password with at least 10 characters.', { field: 'password' });
  if (password.length > 200) throw badRequest('That password is too long (200 characters maximum).', { field: 'password' });
  const lower = password.toLowerCase();
  const local = email.split('@')[0]?.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password) || (local && local.length >= 4 && lower.includes(local))) {
    throw badRequest('That password is too easy to guess. Try a longer phrase.', { field: 'password' });
  }
}
