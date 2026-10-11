import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser } from './helpers.js';

const DAY = 86400;
const AT = new Date('2026-10-06T14:00:00Z'); // afternoon in UTC, which is where an account with no saved time zone lives
const sec = Math.floor(AT.getTime() / 1000);

describe('"your free Pro is about to end" notices', () => {
  let t;
  const emails = [];
  let mailFails = false;
  before(async () => {
    t = await startTestServer({
      env: { APP_URL: 'https://app.example.com' },
      overrides: {
        mailer: {
          configured: true,
          send: async (m) => {
            if (mailFails) throw new Error('smtp down');
            emails.push(m);
            return { delivered: true };
          }
        }
      }
    });
  });
  after(() => t.close());
  beforeEach(() => {
    emails.length = 0;
    mailFails = false;
    t.deps.db.run('DELETE FROM reminder_log');
    t.deps.db.run("UPDATE users SET plan = 'free', plan_status = NULL, plan_renews_at = NULL, email_notices = 1"); // each case starts with nobody on free Pro
  });

  async function member({ left, status = 'granted', plan = 'pro', locale } = {}) {
    const c = t.client();
    const reg = await registerUser(c, { name: 'Ada Lovelace' });
    if (locale) await c.patch('/api/profile', { locale });
    t.deps.repos.users.setPlan(reg.user.id, { plan, status, renewsAt: sec + left });
    return reg;
  }
  const run = (at = AT) => t.deps.reminders.tickNotices(at);

  test('five days out: one email with the end date, a way to keep Pro, and an unsubscribe link; never twice', async () => {
    const m = await member({ left: 5 * DAY });
    assert.equal((await run()).sent, 1);
    assert.equal(emails.length, 1);
    const mail = emails[0];
    assert.equal(mail.to, m.email);
    assert.match(mail.subject, /Your free Pro ends on October 11, 2026/);
    assert.match(mail.text, /https:\/\/app\.example\.com\/pro/);
    assert.match(mail.text, /unsubscribe\?u=/);
    assert.match(mail.text, /Nothing is charged/);
    assert.equal((await run(new Date(AT.getTime() + 3600_000))).sent, 0, 'not again an hour later');
    assert.equal(emails.length, 1);
  });

  test('the last day gets its own notice, and the days in between get nothing', async () => {
    const day1 = await member({ left: 10 * 3600 });
    const between = await member({ left: Math.round(1.5 * DAY) });
    const far = await member({ left: 30 * DAY });
    await run();
    assert.deepEqual(emails.map((e) => e.to), [day1.email]);
    assert.match(emails[0].subject, /ends tomorrow/);
    assert.ok(between && far);
  });

  test('the week-ahead notice and the last-day notice are separate, once each', async () => {
    const m = await member({ left: 5 * DAY });
    await run();
    assert.equal(emails.length, 1);
    const later = new Date(AT.getTime() + 4 * DAY * 1000); // a day before it ends, in the afternoon
    await run(later);
    assert.equal(emails.length, 2);
    assert.match(emails[1].subject, /ends tomorrow/);
    await run(new Date(later.getTime() + 3600_000));
    assert.equal(emails.length, 2);
    assert.ok(m);
  });

  test('nothing is sent at night, and it goes out in the daytime instead', async () => {
    await member({ left: 5 * DAY });
    assert.equal((await run(new Date('2026-10-06T03:00:00Z'))).sent, 0);
    assert.equal(emails.length, 0);
    assert.equal((await run(AT)).sent, 1);
  });

  test('only time-limited free Pro: not paying subscribers, not free accounts', async () => {
    await member({ left: 5 * DAY, status: 'active' });
    await member({ left: 5 * DAY, plan: 'free', status: null });
    await run();
    assert.equal(emails.length, 0);
  });

  test('the unsubscribe link switches these emails off', async () => {
    const m = await member({ left: 5 * DAY });
    const token = t.deps.reminders.unsubscribeUrl(m.user.id).match(/t=([^&]+)/)[1];
    assert.equal(t.deps.reminders.unsubscribe(m.user.id, token), true);
    await run();
    assert.equal(emails.length, 0);
  });

  test('a mail server failure is retried on the next pass instead of being lost', async () => {
    await member({ left: 5 * DAY });
    mailFails = true;
    assert.equal((await run()).sent, 0);
    mailFails = false;
    assert.equal((await run(new Date(AT.getTime() + 300_000))).sent, 1);
    assert.equal(emails.length, 1);
  });

  test('it arrives in the person’s language', async () => {
    await member({ left: 5 * DAY, locale: 'de' });
    await run();
    assert.match(emails[0].subject, /Ihr kostenloses Pro endet am 11\. Oktober 2026/);
  });
});
