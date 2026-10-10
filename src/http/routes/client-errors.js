import { Router } from 'express';
import { rateLimit } from '../middleware.js';
import { object, string, optional } from '../../util/validate.js';
import { now } from '../../db/index.js';

const schema = object({
  message: string({ min: 1, max: 300, trim: false }),
  stack: optional(string({ max: 1500, trim: false }), ''),
  path: optional(string({ max: 100 }), '/'),
  build: optional(string({ max: 40 }), '')
});

const MAX_ROWS = 5000;

/** The browser reports errors in the app's own code here; the Business → System tab shows them. */
export function clientErrorRoutes({ db, log }) {
  const r = Router();
  // anonymous on purpose (the sign-in page can break too), so it is tightly limited
  const limit = rateLimit({ windowMs: 60_000, max: 12, message: 'Too many requests. Please slow down.' });
  r.post('/client-errors', limit, (req, res) => {
    const e = schema(req.body);
    // paths only (never query strings, which can hold tokens), and nothing that looks like a secret in the text
    const clean = (s) => String(s).replace(/(token|code|key|secret)=[^&\s"']+/gi, '$1=…').slice(0, 1500);
    try {
      db.run(
        'INSERT INTO client_errors (created_at, build, path, message, stack, agent, user_id) VALUES (?,?,?,?,?,?,?)',
        now(), e.build, e.path.split('?')[0], clean(e.message).slice(0, 300), clean(e.stack), String(req.get('user-agent') || '').slice(0, 160), req.user?.id ?? null
      );
      if (Math.random() < 0.02) db.run('DELETE FROM client_errors WHERE id <= (SELECT MAX(id) FROM client_errors) - ?', MAX_ROWS);
    } catch (err) {
      log.warn('client_error.store_failed', { detail: err.message });
    }
    res.status(204).end();
  });
  return r;
}
