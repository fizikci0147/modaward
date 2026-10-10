import { Router } from 'express';
import { requireUser } from '../middleware.js';
import { object, string, optional } from '../../util/validate.js';
import { unauthorized } from '../../util/errors.js';
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
      reminders: reminders?.get(id) ?? null
    };
    res.setHeader('Content-Disposition', 'attachment; filename="modaward-export.json"');
    res.json(data);
  });

  r.delete('/account', async (req, res) => {
    const { password } = deleteSchema(req.body);
    if (!(await verifyPassword(password, req.user.password_hash))) throw unauthorized('That password is not correct.');
    const files = repos.garments.allImageNames(req.user.id);
    await billing?.cancelForUser(req.user).catch((e) => log.error('billing.cancel_failed', { user: req.user.id, message: e.message }));
    repos.users.remove(req.user.id); // cascades to every table
    for (const f of files) images.remove(f);
    clearSessionCookie(req, res);
    log.info('account.deleted', { user: req.user.id });
    res.json({ ok: true });
  });

  return r;
}
