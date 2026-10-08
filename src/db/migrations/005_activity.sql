-- One row per person per hour in which they used the app (UTC hour number since the epoch).
-- Powers the "when do people use it" charts without storing what they did.
CREATE TABLE user_activity (
  user_id TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hour    INTEGER NOT NULL,
  PRIMARY KEY (user_id, hour)
) WITHOUT ROWID;
CREATE INDEX idx_activity_hour ON user_activity(hour);
