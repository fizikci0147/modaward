import { Router } from 'express';
import { requireUser } from '../middleware.js';
import { object, string, optional } from '../../util/validate.js';
import { unauthorized, HttpError } from '../../util/errors.js';
import { hashPassword, verifyPassword, assertStrongPassword } from '../../services/passwords.js';
import { publicUser } from '../../repo/index.js';
import { clearSessionCookie } from '../middleware.js';

const nameSchema = object({ name: string({ max: 60 }) });
const passwordSchema = object({ current: string({ min: 1, max: 200, trim: false }), next: string({ min: 1, max: 200, trim: false }) });
const deleteSchema = object({ password: string({ min: 1, max: 200, trim: false }), confirm: optional(string({ max: 20 }), undefined) });

export function accountRoutes({ repos, images, billing, log, reminders }) {
  const r = Router();
  r.use('/account', requireUser);

  r.patch('/account', (req, res) => {
    const { name } = nameSchema(req.body);
    repos.users.setName(req.user.id, name);
    res.json({ user: publicUser(repos.users.byId(req.user.id)) });
  });

  r.post('/account/password', async (req, res) => {
    const { current, next } = passwordSchema(req.body);
    if (!(await verifyPassword(current, req.user.password_hash))) throw unauthorized('Your current password is not correct.');
    assertStrongPassword(next, req.user.email);
    repos.users.setPassword(req.user.id, await hashPassword(next));
    repos.sessions.revokeAll(req.user.id, req.sessionToken); // sign out everywhere else
    res.json({ ok: true });
  });

  /** Everything we hold about the person, as a download. */
  r.get('/account/export', (req, res) => {
    const id = req.user.id;
    const data = {
      exportedAt: new Date().toISOString(),
      account: publicUser(req.user),
      profile: repos.profiles.get(id),
      tasteModel: repos.profiles.getTaste(id),
      garments: repos.garments.list(id, { includeArchived: true }),
      wearHistory: repos.wear.recent(id, 3650),
      savedLooks: repos.saved.list(id),
      plannedDays: repos.plans.list(id, '0000-01-01', '9999-12-31'),
      reminders: reminders?.get(id) ?? null,
      // the rest of what is stored against the account, so the download is complete
      feedback: repos.db.all('SELECT kind, target_key AS target, signal, created_at AS createdAt FROM feedback WHERE user_id = ?', id),
      shopClicks: repos.db.all('SELECT * FROM click_events WHERE user_id = ?', id).map(({ user_id, ...rest }) => rest),
      aiUsage: repos.db.all('SELECT day, kind, calls, input_tokens AS inputTokens, output_tokens AS outputTokens FROM ai_usage WHERE user_id = ?', id),
      proCodesUsed: repos.db.all('SELECT code, redeemed_at AS redeemedAt FROM pro_redemptions WHERE user_id = ?', id),
      notificationDevices: repos.db.get('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', id).n,
      signedInDevices: repos.db.get('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', id).n,
      photos: 'Your photos are not in this file. Each piece in your closet has its photo in the app; ask us if you need the original files.'
    };
    res.setHeader('Content-Disposition', 'attachment; filename="modaward-export.json"');
    res.json(data);
  });

  r.delete('/account', async (req, res) => {
    const { password } = deleteSchema(req.body);
    if (!(await verifyPassword(password, req.user.password_hash))) throw unauthorized('That password is not correct.');
    const files = repos.garments.allImageNames(req.user.id);
    // if the subscription cannot be cancelled, keep the account: deleting it would leave the person being charged
    try {
      await billing?.cancelForUser(req.user);
    } catch (e) {
      log.error('billing.cancel_failed', { user: req.user.id, message: e.message });
      throw new HttpError(502, 'cancel_failed', 'We could not cancel your subscription, so your account was not deleted. Please try again in a few minutes.');
    }
    repos.users.remove(req.user.id); // cascades to every table
    for (const f of files) {
      try {
        images.remove(f);
      } catch (e) {
        // the account is already gone: one file that will not delete must not hide that or strand the rest
        log.warn('account.photo_delete_failed', { message: String(e?.message || '').slice(0, 120) });
      }
    }
    clearSessionCookie(req, res);
    log.info('account.deleted', { user: req.user.id });
    res.json({ ok: true });
  });

  return r;
}
