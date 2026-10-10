-- What a piece cost (for cost-per-wear), and what each day is for (events the person plans).
ALTER TABLE garments ADD COLUMN price_cents INTEGER;

CREATE TABLE day_plans (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  occasion   TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
) WITHOUT ROWID;
