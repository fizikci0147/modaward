import { Router } from 'express';
import { rateLimit, clientKey, setSessionCookie, clearSessionCookie } from '../middleware.js';
import { object, string, email as emailRule, optional } from '../../util/validate.js';
import { HttpError, conflict, forbidden, unauthorized } from '../../util/errors.js';
import { hashPassword, verifyPassword, verifyAgainstDummy, assertStrongPassword, needsRehash } from '../../services/passwords.js';
import { publicUser } from '../../repo/index.js';
import { entitlements } from '../../services/plans.js';
import { baseUrl } from '../base-url.js';

const registerSchema = object({ email: emailRule(), password: string({ min: 1, max: 200, trim: false }), name: optional(string({ max: 60 }), '') });
const loginSchema = object({ email: emailRule(), password: string({ min: 1, max: 200, trim: false }) });
const forgotSchema = object({ email: emailRule() });
const resetSchema = object({ token: string({ min: 64, max: 64 }), password: string({ min: 1, max: 200, trim: false }) });

export function authRoutes({ config, repos, mailer, log, capabilities }) {
  const r = Router();
  // one bucket per action, so people behind a shared address cannot lock each other out of everything
  const bucket = () => rateLimit({ windowMs: 15 * 60_000, max: config.limits.auth, message: 'Too many attempts. Please wait a few minutes.' });
  const registerLimit = bucket();
  const loginLimit = bucket();
  const forgotLimit = bucket();
  const resetLimit = bucket();
  // a reset email goes to someone else's inbox, so cap it per recipient whoever asks
  // (it answers exactly as a normal request does, so nobody can use it to block someone else's reset or probe addresses)
  const emailOf = (req) => (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '');
  const forgotPerEmail = rateLimit({ windowMs: 3_600_000, max: 3, key: (req) => `forgot|${emailOf(req)}`, onLimit: (_req, res) => res.json({ ok: true }) });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const perAccount = rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    key: (req) => `${clientKey(req.ip)}|${emailOf(req)}`,
    message: 'Too many sign-in attempts for this account. Please wait a few minutes or reset your password.'
  });

  const me = (user) => ({
    user: user ? { ...publicUser(user), isAdmin: config.adminEmails.includes(user.email.toLowerCase()) } : null,
    profile: user ? repos.profiles.get(user.id) : null,
    capabilities,
    entitlements: user ? entitlements(user, config) : null,
    app: { version: config.version, build: config.build.id }
  });

  r.get('/me', (req, res) => res.json(me(req.user)));

  r.post('/register', registerLimit, async (req, res) => {
    if (!config.registrationOpen) throw forbidden('Sign-ups are closed right now.');
    const { email, password, name } = registerSchema(req.body);
    assertStrongPassword(password, email);
    if (repos.users.byEmail(email)) throw conflict('An account with that email already exists. Try signing in.');
    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = repos.users.create({ email, passwordHash, name });
    } catch (e) {
      if (/UNIQUE/i.test(String(e?.message))) throw conflict('An account with that email already exists. Try signing in.');
      throw e;
    }
    setSessionCookie(req, res, repos.sessions.create(user.id, req.get('user-agent'), config.sessionDays), config.sessionDays);
    log.info('auth.register', { user: user.id });
    res.status(201).json(me(user));
  });

  r.post('/login', loginLimit, perAccount, async (req, res) => {
    const { email, password } = loginSchema(req.body);
    const user = repos.users.byEmail(email);
    if (!user) {
      await verifyAgainstDummy(password);
      throw unauthorized('Incorrect email or password.');
    }
    if (!(await verifyPassword(password, user.password_hash))) throw unauthorized('Incorrect email or password.');
    if (needsRehash(user.password_hash)) repos.users.setPassword(user.id, await hashPassword(password));
    setSessionCookie(req, res, repos.sessions.create(user.id, req.get('user-agent'), config.sessionDays), config.sessionDays);
    repos.users.touch(user.id);
    res.json(me(user));
  });

  r.post('/logout', (req, res) => {
    if (req.sessionToken) repos.sessions.revoke(req.sessionToken);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Always answers the same way so the endpoint cannot be used to discover registered emails.
  r.post('/forgot', forgotLimit, forgotPerEmail, async (req, res) => {
    const { email } = forgotSchema(req.body);
    const user = repos.users.byEmail(email);
    const base = baseUrl(config, req);
    if (user && base) {
      const token = repos.resets.create(user.id);
      const link = `${base}/reset?token=${token}`;
      const t = req.t;
      const hello = user.name ? t('Hi {name},', { name: user.name }) : t('Hi,');
      // not awaited: how long the mail server takes must not reveal that the address has an account
      mailer
        .send({
          to: user.email,
          subject: t('Reset your ModaWard password'),
          text: `${hello}\n\n${t('Use this link within one hour to choose a new password:')}\n${link}\n\n${t('If you did not ask for this, you can ignore this email.')}\n\nModaWard`,
          html: `<p>${esc(hello)}</p><p><a href="${esc(link)}">${t('Choose a new password')}</a>. ${t('The link works for one hour.')}</p><p>${t('If you did not ask for this, you can ignore this email.')}</p>`
        })
        .catch((e) => log.error('auth.reset_mail_failed', { user: user.id, message: e.message }));
    } else if (user && !base) {
      log.error('auth.reset_needs_app_url', {});
    }
    res.json({ ok: true });
  });

  r.post('/reset', resetLimit, async (req, res) => {
    const { token, password } = resetSchema(req.body);
    // check the password first so a weak one does not burn the single-use token
    assertStrongPassword(password);
    const userId = repos.resets.consume(token);
    if (!userId) throw new HttpError(400, 'invalid_token', 'That reset link is invalid or has expired. Request a new one.');
    repos.users.setPassword(userId, await hashPassword(password));
    repos.sessions.revokeAll(userId);
    log.info('auth.password_reset', { user: userId });
    res.json({ ok: true });
  });

  return r;
}
