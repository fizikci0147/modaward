-- Reminders: what each person wants to be nudged about, their push subscriptions, and a log
-- that stops the same reminder going out twice.

CREATE TABLE reminder_prefs (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_on   INTEGER NOT NULL DEFAULT 0,
  daily_hour INTEGER NOT NULL DEFAULT 7 CHECK (daily_hour BETWEEN 0 AND 23),
  weekly_on  INTEGER NOT NULL DEFAULT 0,
  idle_on    INTEGER NOT NULL DEFAULT 0,
  push_on    INTEGER NOT NULL DEFAULT 1,
  email_on   INTEGER NOT NULL DEFAULT 0,
  tz         TEXT    NOT NULL DEFAULT 'UTC',
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_reminder_prefs_on ON reminder_prefs(daily_on, weekly_on, idle_on);

CREATE TABLE push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  failures   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);

CREATE TABLE reminder_log (
  user_id TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind    TEXT    NOT NULL,
  day     TEXT    NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, day)
) WITHOUT ROWID;
