import { Router } from 'express';
import { requireUser } from '../middleware.js';
import { forbidden } from '../../util/errors.js';
import { object, string, integer, optional, email } from '../../util/validate.js';

const codeSchema = object({
  code: optional(string({ min: 4, max: 32 })),
  days: integer({ min: 1, max: 3660 }),
  maxUses: optional(integer({ min: 1, max: 100000 }), 1),
  expiresInDays: optional(integer({ min: 1, max: 3660 })),
  note: optional(string({ max: 200 }), '')
});
const grantSchema = object({ email: email(), days: integer({ min: 1, max: 3660 }) });

/** Operator dashboard data. Access is limited to the emails in ADMIN_EMAILS. */
export function adminRoutes({ db, config, usage, catalog, codes, weather, capabilities, mailer }) {
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
    const insight = audienceInsight(db, nowS);
    res.json({
      ...insight,
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

  /** One-click health check of everything the live site depends on, with the exact failure reasons. */
  r.get('/admin/system', async (_req, res) => {
    const probe = await weather.probe();
    res.json({
      checkedAt: new Date().toISOString(),
      node: process.version,
      build: config.build,
      uptimeMinutes: Math.round(process.uptime() / 60),
      database: db.driver,
      production: config.production,
      appUrl: config.appUrl || null,
      trustProxy: config.trustProxy ?? null,
      weather: { provider: weather.provider, probe, lastError: weather.lastError },
      integrations: { ai: Boolean(capabilities?.ai), stripe: Boolean(capabilities?.billing), email: Boolean(mailer?.configured), backgroundRemovalService: Boolean(capabilities?.cutoutService) }
    });
  });

  r.get('/admin/activity', (req, res) => {
    const off = Math.max(-840, Math.min(840, Number.parseInt(req.query.tz, 10) || 0)); // viewer's minutes ahead of UTC
    const shift = off * 60;
    const nowHour = Math.floor(Date.now() / 3_600_000);
    const since90 = nowHour - 90 * 24;
    const since30 = nowHour - 30 * 24;
    const cells = db.all(
      'SELECT ((hour * 3600 + ?) / 86400 + 4) % 7 AS wd, ((hour * 3600 + ?) / 3600) % 24 AS hr, COUNT(*) AS n FROM user_activity WHERE hour >= ? GROUP BY wd, hr',
      shift,
      shift,
      since90
    );
    const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const c of cells) heat[c.wd][c.hr] = c.n;
    const days = db.all('SELECT (hour * 3600 + ?) / 86400 AS d, COUNT(DISTINCT user_id) AS n FROM user_activity WHERE hour >= ? GROUP BY d ORDER BY d', shift, since30);
    const dayLabel = (d) => new Date(d * 86400_000).toISOString().slice(0, 10);
    const mau = db.get('SELECT COUNT(DISTINCT user_id) AS n FROM user_activity WHERE hour >= ?', since30).n;
    const perUser = db.get('SELECT AVG(d) AS avg FROM (SELECT COUNT(DISTINCT (hour * 3600 + ?) / 86400) AS d FROM user_activity WHERE hour >= ? GROUP BY user_id)', shift, since30).avg;
    const last7 = days.slice(-7);
    const avgDau = last7.length ? last7.reduce((s, d) => s + d.n, 0) / last7.length : 0;
    res.json({
      tracking: db.get('SELECT MIN(hour) AS h FROM user_activity').h ? new Date(db.get('SELECT MIN(hour) AS h FROM user_activity').h * 3_600_000).toISOString().slice(0, 10) : null,
      heat,
      byHour: Array.from({ length: 24 }, (_, h) => heat.reduce((s, row) => s + row[h], 0)),
      byWeekday: heat.map((row) => row.reduce((s, n) => s + n, 0)),
      daily: days.map((d) => ({ day: dayLabel(d.d), users: d.n })),
      mau,
      avgDau: Math.round(avgDau * 10) / 10,
      stickiness: mau ? Math.round((avgDau / mau) * 1000) / 10 : 0,
      activeDaysPerUser: Math.round((perUser || 0) * 10) / 10
    });
  });

  r.get('/admin/users', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase().slice(0, 80);
    const plan = ['free', 'pro'].includes(req.query.plan) ? req.query.plan : null;
    const sort = { joined: 'u.created_at DESC', active: 'COALESCE(u.last_seen_at, 0) DESC', closet: 'pieces DESC' }[req.query.sort] || 'u.created_at DESC';
    const page = Math.max(0, Math.min(10_000, Number.parseInt(req.query.page, 10) || 0));
    const where = [];
    const args = [];
    if (q) {
      where.push("(u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
      const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      args.push(like, like);
    }
    if (plan) (where.push('u.plan = ?'), args.push(plan));
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.get(`SELECT COUNT(*) AS n FROM users u ${clause}`, ...args).n;
    const rows = db.all(
      `SELECT u.id, u.email, u.name, u.plan, u.plan_status, u.plan_renews_at, u.created_at, u.last_seen_at,
         (SELECT COUNT(*) FROM garments g WHERE g.user_id = u.id AND g.archived = 0) AS pieces,
         (SELECT COUNT(*) FROM wear_log w WHERE w.user_id = u.id) AS wears,
         (SELECT COUNT(*) FROM saved_looks s WHERE s.user_id = u.id) AS saved,
         (SELECT COUNT(*) FROM click_events c WHERE c.user_id = u.id) AS clicks,
         (SELECT p.data FROM profiles p WHERE p.user_id = u.id) AS profile
       FROM users u ${clause} ORDER BY ${sort} LIMIT 25 OFFSET ?`,
      ...args,
      page * 25
    );
    res.json({
      total,
      page,
      users: rows.map(({ profile, ...u }) => {
        let p = {};
        try {
          p = JSON.parse(profile || '{}');
        } catch {
          /* leave empty */
        }
        return { ...u, city: p.location?.name ?? null, department: p.department ?? null, quizDone: Boolean(p.style?.quizDone), configured: config.adminEmails.includes(u.email.toLowerCase()) };
      })
    });
  });

  r.get('/admin/codes', (_req, res) => res.json({ codes: codes.list() }));
  r.post('/admin/codes', (req, res) => res.status(201).json(codes.create(codeSchema(req.body ?? {}))));
  r.delete('/admin/codes/:code', (req, res) => {
    codes.remove(req.params.code);
    res.json({ ok: true });
  });
  r.post('/admin/grants', (req, res) => {
    const { email: to, days } = grantSchema(req.body ?? {});
    res.json(codes.grant(to, days));
  });
  return r;
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

/** Audience, funnel and behaviour numbers: what the business needs to see at a glance. */
function audienceInsight(db, nowS) {
  const day = 86400;
  const n = (sql, ...p) => db.get(sql, ...p).n;
  const total = n('SELECT COUNT(*) AS n FROM users');

  // profiles are small JSON documents; read them once and tally in memory
  const dept = {};
  const age = {};
  const cities = {};
  const styles = {};
  const occasions = {};
  let quiz = 0;
  let located = 0;
  for (const { data } of db.all('SELECT data FROM profiles LIMIT 50000')) {
    let p;
    try {
      p = JSON.parse(data);
    } catch {
      continue;
    }
    if (p.department) dept[p.department] = (dept[p.department] || 0) + 1;
    if (p.ageRange) age[p.ageRange] = (age[p.ageRange] || 0) + 1;
    if (p.location?.name) (located += 1, (cities[p.location.name] = (cities[p.location.name] || 0) + 1));
    if (p.style?.quizDone) quiz += 1;
    for (const [k, w] of Object.entries(p.style?.archetypes || {})) if (w > 0) styles[k] = (styles[k] || 0) + 1;
    for (const o of p.lifestyle?.occasions || []) occasions[o] = (occasions[o] || 0) + 1;
  }
  const top = (obj, limit = 8) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, count]) => ({ label, count }));

  const withCloset = n('SELECT COUNT(DISTINCT user_id) AS n FROM garments');
  const closet5 = n('SELECT COUNT(*) AS n FROM (SELECT user_id FROM garments GROUP BY user_id HAVING COUNT(*) >= 5)');
  const wore = n('SELECT COUNT(DISTINCT user_id) AS n FROM wear_log');
  const reacted = n('SELECT COUNT(DISTINCT user_id) AS n FROM feedback');
  const clicked = n('SELECT COUNT(DISTINCT user_id) AS n FROM click_events WHERE user_id IS NOT NULL');
  const paid = n("SELECT COUNT(*) AS n FROM users WHERE plan = 'pro' AND COALESCE(plan_status, '') != 'granted'");
  const comped = n("SELECT COUNT(*) AS n FROM users WHERE plan = 'pro' AND plan_status = 'granted'");
  const steps = [
    ['Signed up', total],
    ['Took the style quiz', quiz],
    ['Set a location', located],
    ['Added a garment', withCloset],
    ['Closet of 5 or more', closet5],
    ['Wore a suggested outfit', wore],
    ['Reacted to shop looks', reacted],
    ['Clicked through to a store', clicked],
    ['Pro (paying or comped)', paid + comped]
  ].map(([label, count]) => ({ label, count, percent: pct(count, total) }));

  // retention: of people who joined 7 to 60 days ago, how many were seen again 7+ days after joining
  const cohort = n('SELECT COUNT(*) AS n FROM users WHERE created_at BETWEEN ? AND ?', nowS - 60 * day, nowS - 7 * day);
  const returned = n('SELECT COUNT(*) AS n FROM users WHERE created_at BETWEEN ? AND ? AND last_seen_at >= created_at + ?', nowS - 60 * day, nowS - 7 * day, 7 * day);
  const day1 = n('SELECT COUNT(*) AS n FROM users WHERE created_at BETWEEN ? AND ? AND last_seen_at >= created_at + ?', nowS - 60 * day, nowS - 2 * day, day);

  return {
    plans: { free: total - paid - comped, paid, comped },
    audience: { departments: top(dept), ages: top(age), cities: top(cities, 10), styles: top(styles, 10), occasions: top(occasions), profiled: total },
    funnel: steps,
    retention: { cohort, week1: pct(returned, cohort), day1: pct(day1, n('SELECT COUNT(*) AS n FROM users WHERE created_at BETWEEN ? AND ?', nowS - 60 * day, nowS - 2 * day)) },
    closetMix: db.all('SELECT category AS label, COUNT(*) AS count FROM garments WHERE archived = 0 GROUP BY category ORDER BY count DESC'),
    reactions: db.all('SELECT kind AS label, signal, COUNT(*) AS count FROM feedback WHERE created_at > ? GROUP BY kind, signal ORDER BY count DESC', nowS - 30 * day),
    topGarmentBrands: db.all("SELECT brand AS label, COUNT(*) AS count FROM garments WHERE brand != '' GROUP BY brand ORDER BY count DESC LIMIT 8")
  };
}
