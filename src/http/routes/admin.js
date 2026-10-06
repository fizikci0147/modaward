import { Router } from 'express';
import { requireUser } from '../middleware.js';
import { forbidden } from '../../util/errors.js';

/** Operator dashboard data. Access is limited to the emails in ADMIN_EMAILS. */
export function adminRoutes({ db, config, usage, catalog }) {
  const r = Router();
  r.use('/admin', requireUser, (req, _res, next) => (config.adminEmails.includes(req.user.email.toLowerCase()) ? next() : next(forbidden('Not found.'))));

  r.get('/admin/metrics', (_req, res) => {
    const nowS = Math.floor(Date.now() / 1000);
    const n = (sql, ...p) => db.get(sql, ...p).n;
    const day = 86400;
    const users = {
      total: n('SELECT COUNT(*) AS n FROM users'),
      pro: n("SELECT COUNT(*) AS n FROM users WHERE plan = 'pro'"),
      new7: n('SELECT COUNT(*) AS n FROM users WHERE created_at > ?', nowS - 7 * day),
      new30: n('SELECT COUNT(*) AS n FROM users WHERE created_at > ?', nowS - 30 * day),
      dau: n('SELECT COUNT(*) AS n FROM users WHERE last_seen_at > ?', nowS - day),
      wau: n('SELECT COUNT(*) AS n FROM users WHERE last_seen_at > ?', nowS - 7 * day),
      mau: n('SELECT COUNT(*) AS n FROM users WHERE last_seen_at > ?', nowS - 30 * day)
    };
    const closet = {
      pieces: n('SELECT COUNT(*) AS n FROM garments'),
      withPhotos: n('SELECT COUNT(*) AS n FROM garments WHERE image_path IS NOT NULL'),
      usersWithCloset: n('SELECT COUNT(DISTINCT user_id) AS n FROM garments'),
      wearLogs30: n('SELECT COUNT(*) AS n FROM wear_log WHERE created_at > ?', nowS - 30 * day)
    };
    const engagement = {
      feedback30: n('SELECT COUNT(*) AS n FROM feedback WHERE created_at > ?', nowS - 30 * day),
      savedLooks: n('SELECT COUNT(*) AS n FROM saved_looks'),
      quizCompleted: n("SELECT COUNT(*) AS n FROM profiles WHERE data LIKE '%\"quizDone\":true%'")
    };
    const clicks = db.all('SELECT retailer, COUNT(*) AS clicks, SUM(CASE WHEN kind = \'product\' THEN 1 ELSE 0 END) AS product_clicks FROM click_events WHERE created_at > ? GROUP BY retailer ORDER BY clicks DESC', nowS - 30 * day);
    const clicksByDay = db.all("SELECT date(created_at, 'unixepoch') AS day, COUNT(*) AS clicks FROM click_events WHERE created_at > ? GROUP BY day ORDER BY day", nowS - 14 * day);
    const signups = db.all("SELECT date(created_at, 'unixepoch') AS day, COUNT(*) AS n FROM users WHERE created_at > ? GROUP BY day ORDER BY day", nowS - 14 * day);
    res.json({
      generatedAt: new Date().toISOString(),
      users,
      conversion: users.total ? Math.round((users.pro / users.total) * 1000) / 10 : 0,
      closet,
      engagement,
      clicks: { last30: clicks, byDay: clicksByDay, total30: clicks.reduce((s, c) => s + c.clicks, 0) },
      signups,
      catalogue: { products: catalog.count(), byRetailer: catalog.byRetailer() },
      ai: { today: usage.totals() }
    });
  });
  return r;
}
