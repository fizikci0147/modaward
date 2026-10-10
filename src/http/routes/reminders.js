import { Router } from 'express';
import { requireUser, rateLimit } from '../middleware.js';
import { object, partial, string, boolean, integer, optional, oneOf } from '../../util/validate.js';
import { badRequest, unavailable } from '../../util/errors.js';
import { isPushEndpoint } from '../../services/push.js';
import { isTimeZone, KINDS } from '../../services/reminders.js';

const prefsSchema = partial({
  daily: partial({ on: boolean(), hour: integer({ min: 0, max: 23 }) }),
  weekly: partial({ on: boolean() }),
  idle: partial({ on: boolean() }),
  push: boolean(),
  email: boolean(),
  tz: string({ max: 64 })
});
const subscribeSchema = object({
  endpoint: string({ min: 20, max: 800 }),
  keys: object({ p256dh: string({ min: 20, max: 200 }), auth: string({ min: 8, max: 100 }) })
});
const endpointSchema = object({ endpoint: string({ min: 20, max: 800 }) });
const testSchema = object({ kind: optional(oneOf(KINDS), 'daily') });
const unsubscribeSchema = object({ u: string({ min: 36, max: 36 }), t: string({ min: 20, max: 80 }) });

export function reminderRoutes({ reminders, push, mailer, config }) {
  const r = Router();
  // a test sends a real email to the account's address, so keep it to a few an hour
  const limit = rateLimit({ windowMs: 3_600_000, max: 5, key: (req) => req.user?.id || req.ip, message: 'Too many tests for now. Please try again in a while.' });

  // the one route that needs no sign-in: the unsubscribe link in an email
  r.post('/reminders/unsubscribe', rateLimit({ windowMs: 60_000, max: 20, message: 'Too many attempts. Please try again in a minute.' }), (req, res) => {
    const { u, t } = unsubscribeSchema(req.body);
    if (!reminders.unsubscribe(u, t)) throw badRequest('That link is not valid any more.');
    res.json({ ok: true });
  });

  r.use('/reminders', requireUser);

  const state = (req) => ({
    prefs: reminders.get(req.user.id),
    push: { available: Boolean(push), publicKey: push?.publicKey ?? null, devices: push ? push.count(req.user.id) : 0 },
    emailAvailable: Boolean(mailer?.configured && config.appUrl)
  });

  r.get('/reminders', (req, res) => res.json(state(req)));

  r.put('/reminders', (req, res) => {
    const input = prefsSchema(req.body);
    if (input.tz !== undefined && !isTimeZone(input.tz)) throw badRequest('That time zone is not recognised.');
    reminders.set(req.user.id, input);
    res.json(state(req));
  });

  r.post('/reminders/push/subscribe', (req, res) => {
    if (!push) throw unavailable('Notifications are not switched on for this site.');
    const sub = subscribeSchema(req.body);
    if (!isPushEndpoint(sub.endpoint)) throw badRequest('That notification service is not supported.');
    push.subscribe(req.user.id, sub, req.get('user-agent'));
    res.json(state(req));
  });

  r.post('/reminders/push/unsubscribe', (req, res) => {
    const { endpoint } = endpointSchema(req.body);
    push?.unsubscribe(req.user.id, endpoint);
    res.json(state(req));
  });

  // "send me a test": the real message for today, sent now through the person's chosen channels
  r.post('/reminders/test', limit, async (req, res) => {
    const { kind } = testSchema(req.body ?? {});
    res.json(await reminders.sendNow(req.user, kind));
  });

  return r;
}
