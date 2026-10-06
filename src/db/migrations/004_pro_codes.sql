-- Redeemable Pro codes (comped access without Stripe) and who used them.
CREATE TABLE pro_codes (
  code        TEXT PRIMARY KEY,
  days        INTEGER NOT NULL CHECK (days BETWEEN 1 AND 3660),
  max_uses    INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  uses        INTEGER NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  expires_at  INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE TABLE pro_redemptions (
  code        TEXT NOT NULL REFERENCES pro_codes(code) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at INTEGER NOT NULL,
  PRIMARY KEY (code, user_id)
);
