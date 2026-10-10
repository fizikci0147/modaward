-- The admin dashboard counts recent wears and feedback by time, and the reminder log is trimmed
-- by age: without these each of those scans the whole table.
CREATE INDEX IF NOT EXISTS idx_wear_created ON wear_log(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_reminder_sent ON reminder_log(sent_at);

-- a tiny table the readiness check writes to, so a full disk shows up as 'not ready'
CREATE TABLE IF NOT EXISTS health_probe (id INTEGER PRIMARY KEY, at INTEGER NOT NULL);

CREATE INDEX IF NOT EXISTS idx_users_seen ON users(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
