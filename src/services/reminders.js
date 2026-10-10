/**
 * Reminders: a morning outfit, a Sunday look at the week ahead, and a nudge about pieces that
 * have not been worn in a while. Delivered as push notifications and/or email, in the person's
 * own language and time zone.
 *
 * The scheduler wakes every few minutes. A reminder is "due" when the person's local clock has
 * reached its time (and no more than three hours have passed, so a morning outfit is never sent
 * at night after a restart). A row in reminder_log is claimed before anything is built, which
 * makes each reminder go out at most once per local day even if two processes run at once.
 */
import { now } from '../db/index.js';
import { translatorFor } from '../i18n/index.js';
import { isLocale } from '../shared/i18n.js';
import { describeCode, cToF } from '../shared/weather-codes.js';
import { dormantPieces, daysBetween } from '../shared/dormancy.js';
import { weekDigest } from '../engine/planner.js';
import { hmac, safeEqual } from './secrets.js';

export const KINDS = ['daily', 'weekly', 'idle'];
const CATCH_UP_HOURS = 3;
const WEEKLY = { hour: 18, weekday: 0 }; // Sunday evening
const IDLE = { hour: 10, weekday: 6, everyDays: 14 }; // Saturday morning, at most every two weeks
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const isTimeZone = (tz) => {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** The local calendar date, hour and weekday (0 = Sunday) in a time zone. */
export function localParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: isTimeZone(tz) ? tz : 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: WEEKDAYS.indexOf(p.weekday) };
}

const slot = (kind, prefs) => (kind === 'daily' ? { hour: prefs.daily_hour, weekday: null } : kind === 'weekly' ? WEEKLY : IDLE);
const enabled = (kind, prefs) => Boolean(prefs[`${kind}_on`]);

/** Has the reminder's moment already passed today (so enabling it now should wait for next time)? */
const passed = (kind, prefs, local) => {
  const s = slot(kind, prefs);
  return (s.weekday == null || s.weekday === local.weekday) && local.hour >= s.hour;
};
const due = (kind, prefs, local) => {
  const s = slot(kind, prefs);
  return (s.weekday == null || s.weekday === local.weekday) && local.hour >= s.hour && local.hour - s.hour <= CATCH_UP_HOURS;
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function createReminders({ db, repos, outfits, push, mailer, config, log, secret }) {
  const tokenFor = (userId) => hmac(secret, `unsubscribe:${userId}`);
  const unsubscribeUrl = (userId) => `${config.appUrl}/unsubscribe?u=${encodeURIComponent(userId)}&t=${tokenFor(userId)}`;

  const prefsOf = (userId) => db.get('SELECT * FROM reminder_prefs WHERE user_id = ?', userId);
  const present = (row) => ({
    daily: { on: Boolean(row?.daily_on), hour: row?.daily_hour ?? 7 },
    weekly: { on: Boolean(row?.weekly_on) },
    idle: { on: Boolean(row?.idle_on) },
    push: row ? Boolean(row.push_on) : true,
    email: Boolean(row?.email_on),
    tz: row?.tz || 'UTC'
  });

  const claim = (userId, kind, day) => db.run('INSERT OR IGNORE INTO reminder_log (user_id, kind, day, sent_at) VALUES (?,?,?,?)', userId, kind, day, now()).changes === 1;

  const localeOf = (profile) => (isLocale(profile.locale) ? profile.locale : 'en');
  const unitsTemp = (c, units) => `${Math.round(units === 'imperial' ? cToF(c) : c)}°`;

  /** Build the message for one reminder, or null when there is nothing worth sending. */
  async function build(kind, user, local) {
    const profile = repos.profiles.get(user.id);
    const locale = localeOf(profile);
    const { t, tn } = translatorFor(locale);
    const first = (user.name || '').split(' ')[0];

    if (kind === 'daily') {
      if (!profile.location) return null;
      const plan = repos.plans.get(user.id, local.date);
      const occasion = plan?.occasion || ((profile.workDays || []).includes(local.weekday) ? 'work' : 'casual');
      const data = await outfits.forDay(user, { occasion, count: 1, curate: false, locale });
      const outfit = data.outfits[0];
      if (!outfit) return null;
      const day = data.weather.day;
      const units = data.weather.units;
      const conditions = t(describeCode(day.code).label);
      const title = t('Today: {low} to {high} · {conditions}', { low: unitsTemp(day.tMinC, units), high: unitsTemp(day.tMaxC, units), conditions });
      const items = outfit.items.map((i) => i.name).join(', ');
      const tip = data.tips?.[0]?.text;
      const body = clip(`${items}.${tip ? ` ${tip}` : ''}`, 190);
      return { title, body, url: '/', cta: t('See today’s outfit'), greeting: first ? t('Good morning, {name}', { name: first }) : t('Good morning') };
    }

    if (kind === 'weekly') {
      if (!profile.location) return null;
      const w = await outfits.forecast(user);
      const days = w.days.slice(0, 7);
      if (!days.length) return null;
      const lo = Math.min(...days.map((d) => d.tMinC));
      const hi = Math.max(...days.map((d) => d.tMaxC));
      const wet = weekDigest(days).wetDates.length;
      const rain = wet ? tn(wet, 'Rain on {n} day.', 'Rain on {n} days.') : t('Mostly dry.');
      const body = `${t('{low} to {high} this week.', { low: unitsTemp(lo, w.units), high: unitsTemp(hi, w.units) })} ${rain} ${t('Plan what to wear for each day.')}`;
      return { title: t('Your week ahead'), body: clip(body, 190), url: '/week', cta: t('Plan my week'), greeting: first ? t('Hi {name}', { name: first }) : t('Hi') };
    }

    // idle: pieces that have been waiting a long time
    const last = db.get("SELECT MAX(day) AS d FROM reminder_log WHERE user_id = ? AND kind = 'idle' AND day <> ?", user.id, local.date)?.d;
    if (last && daysBetween(last, local.date) < IDLE.everyDays) return null;
    const list = dormantPieces(repos.garments.list(user.id), local.date);
    if (!list.length) return null;
    const names = list.slice(0, 3).map((g) => g.name).join(', ');
    return {
      title: tn(list.length, '{n} piece has not been worn in a while', '{n} pieces have not been worn in a while'),
      body: clip(`${names}. ${t('Open your closet to style one today.')}`, 190),
      url: '/closet',
      cta: t('Open my closet'),
      greeting: first ? t('Hi {name}', { name: first }) : t('Hi')
    };
  }

  const emailFor = (msg, user) => {
    const link = `${config.appUrl}${msg.url}`;
    const unsub = unsubscribeUrl(user.id);
    const { t } = translatorFor(localeOf(repos.profiles.get(user.id)));
    const footer = t('You get this because you turned on reminders in ModaWard.');
    return {
      subject: msg.title,
      text: `${msg.greeting},\n\n${msg.title}\n${msg.body}\n\n${msg.cta}: ${link}\n\n--\n${footer}\n${t('Turn off emails')}: ${unsub}\n`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 20px;color:#161511;background:#f6f3ed">
<p style="margin:0 0 6px;color:#57534a">${esc(msg.greeting)}</p>
<h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.2;margin:0 0 12px">${esc(msg.title)}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 22px">${esc(msg.body)}</p>
<p style="margin:0 0 30px"><a href="${esc(link)}" style="background:#1f3d33;color:#f6f3ed;text-decoration:none;padding:13px 22px;border-radius:999px;display:inline-block;font-weight:600">${esc(msg.cta)}</a></p>
<p style="font-size:12px;color:#8a8578;margin:0">${esc(footer)} <a href="${esc(unsub)}" style="color:#8a8578">${esc(t('Turn off emails'))}</a></p>
</div>`,
      headers: { 'List-Unsubscribe': `<${unsub}>` }
    };
  };

  /** Send through whichever channels the person enabled. @returns {{push:number, email:boolean}} */
  async function deliver(user, prefs, msg) {
    const out = { push: 0, email: false };
    if (prefs.push_on && push) out.push = await push.notify(user.id, { title: msg.title, body: msg.body, url: msg.url, tag: msg.url });
    if (prefs.email_on && mailer?.configured && config.appUrl) {
      try {
        const r = await mailer.send({ to: user.email, ...emailFor(msg, user) });
        out.email = r.delivered !== false;
      } catch (e) {
        log.warn('reminder.email_failed', { message: String(e?.message || '').slice(0, 160) });
      }
    }
    return out;
  }

  const api = {
    get: (userId) => present(prefsOf(userId)),
    unsubscribeUrl,

    /** Save preferences. A reminder whose time has already passed today waits for its next occurrence. */
    set(userId, input) {
      const cur = present(prefsOf(userId));
      const next = {
        daily: { on: input.daily?.on ?? cur.daily.on, hour: input.daily?.hour ?? cur.daily.hour },
        weekly: { on: input.weekly?.on ?? cur.weekly.on },
        idle: { on: input.idle?.on ?? cur.idle.on },
        push: input.push ?? cur.push,
        email: input.email ?? cur.email,
        tz: input.tz && isTimeZone(input.tz) ? input.tz : cur.tz
      };
      db.run(
        `INSERT INTO reminder_prefs (user_id, daily_on, daily_hour, weekly_on, idle_on, push_on, email_on, tz, updated_at) VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(user_id) DO UPDATE SET daily_on = excluded.daily_on, daily_hour = excluded.daily_hour, weekly_on = excluded.weekly_on, idle_on = excluded.idle_on,
           push_on = excluded.push_on, email_on = excluded.email_on, tz = excluded.tz, updated_at = excluded.updated_at`,
        userId, +next.daily.on, next.daily.hour, +next.weekly.on, +next.idle.on, +next.push, +next.email, next.tz, now()
      );
      const row = prefsOf(userId);
      const local = localParts(new Date(), row.tz);
      for (const kind of KINDS) if (enabled(kind, row) && passed(kind, row, local)) claim(userId, kind, local.date);
      return present(row);
    },

    /** Turn email reminders off from the link in an email. */
    unsubscribe(userId, token) {
      if (!safeEqual(token || '', tokenFor(userId))) return false;
      db.run('UPDATE reminder_prefs SET email_on = 0, updated_at = ? WHERE user_id = ?', now(), userId);
      return true;
    },

    /** Send one reminder now, regardless of schedule (the "send me a test" button). */
    async sendNow(user, kind) {
      const row = prefsOf(user.id) ?? { push_on: 1, email_on: 0, daily_hour: 7, tz: 'UTC' };
      const local = localParts(new Date(), row.tz);
      const msg = await build(kind, user, local);
      if (!msg) return { skipped: true, delivered: { push: 0, email: false } };
      return { skipped: false, message: { title: msg.title, body: msg.body }, delivered: await deliver(user, row, msg) };
    },

    /** One scheduler pass. @returns {Promise<{checked:number, sent:number}>} */
    async tick(at = new Date()) {
      const rows = db.all('SELECT p.*, u.id AS uid FROM reminder_prefs p JOIN users u ON u.id = p.user_id WHERE p.daily_on = 1 OR p.weekly_on = 1 OR p.idle_on = 1');
      let sent = 0;
      for (const row of rows) {
        const local = localParts(at, row.tz);
        for (const kind of KINDS) {
          if (!enabled(kind, row) || !due(kind, row, local)) continue;
          if (!claim(row.user_id, kind, local.date)) continue;
          try {
            const user = repos.users.byId(row.user_id);
            const msg = user && (await build(kind, user, local));
            if (!msg) continue;
            const out = await deliver(user, row, msg);
            if (out.push || out.email) sent += 1;
          } catch (e) {
            log.warn('reminder.failed', { kind, message: String(e?.message || '').slice(0, 160) });
          }
        }
      }
      db.run('DELETE FROM reminder_log WHERE sent_at < ?', now() - 60 * 86400);
      return { checked: rows.length, sent };
    }
  };

  let timer = null;
  let running = false;
  api.start = () => {
    if (!config.reminders.enabled || timer) return;
    timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        await api.tick();
      } catch (e) {
        log.warn('reminder.tick_failed', { message: String(e?.message || '').slice(0, 160) });
      } finally {
        running = false;
      }
    }, config.reminders.intervalSeconds * 1000);
    timer.unref();
  };
  api.stop = () => {
    clearInterval(timer);
    timer = null;
  };
  return api;
}
