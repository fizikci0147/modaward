-- ModaWard initial schema. Timestamps are unix seconds. JSON columns hold validated documents.

CREATE TABLE users (
  id                     TEXT PRIMARY KEY,
  email                  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash          TEXT NOT NULL,
  name                   TEXT NOT NULL DEFAULT '',
  plan                   TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  plan_status            TEXT,
  plan_renews_at         INTEGER,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT,
  created_at             INTEGER NOT NULL,
  last_seen_at           INTEGER
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE TABLE profiles (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL DEFAULT '{}',
  taste      TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

CREATE TABLE garments (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  type       TEXT NOT NULL,
  color      TEXT NOT NULL,
  pattern    TEXT NOT NULL DEFAULT 'solid',
  warmth     REAL NOT NULL,
  formality  REAL NOT NULL,
  waterproof INTEGER NOT NULL DEFAULT 0,
  brand      TEXT NOT NULL DEFAULT '',
  styles     TEXT NOT NULL DEFAULT '[]',
  notes      TEXT NOT NULL DEFAULT '',
  image_path TEXT,
  favorite   INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_garments_user ON garments(user_id, archived);

CREATE TABLE wear_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  worn_on    TEXT NOT NULL,
  outfit_key TEXT NOT NULL,
  occasion   TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, garment_id, worn_on)
);
CREATE INDEX idx_wear_user_date ON wear_log(user_id, worn_on);

CREATE TABLE feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('outfit', 'look')),
  target_key TEXT NOT NULL,
  signal     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_feedback_user ON feedback(user_id, kind, target_key);

CREATE TABLE looks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_looks_user ON looks(user_id, created_at);

CREATE TABLE saved_looks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('outfit', 'look')),
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_saved_user ON saved_looks(user_id, created_at);

CREATE TABLE catalog_products (
  id          TEXT PRIMARY KEY,
  retailer    TEXT NOT NULL,
  sku         TEXT NOT NULL,
  title       TEXT NOT NULL,
  brand       TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL,
  image_url   TEXT NOT NULL,
  price_cents INTEGER,
  currency    TEXT NOT NULL DEFAULT 'USD',
  category    TEXT NOT NULL,
  type        TEXT NOT NULL,
  color       TEXT NOT NULL,
  gender      TEXT NOT NULL DEFAULT 'unisex' CHECK (gender IN ('men', 'women', 'unisex')),
  pattern     TEXT NOT NULL DEFAULT 'solid',
  keywords    TEXT NOT NULL DEFAULT '',
  in_stock    INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL,
  UNIQUE (retailer, sku)
);
CREATE INDEX idx_catalog_type ON catalog_products(type, gender, in_stock);
CREATE INDEX idx_catalog_retailer ON catalog_products(retailer);

CREATE TABLE click_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  retailer   TEXT NOT NULL,
  kind       TEXT NOT NULL,
  host       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_clicks_time ON click_events(created_at);

CREATE TABLE ai_usage (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  kind          TEXT NOT NULL,
  calls         INTEGER NOT NULL DEFAULT 0,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);

CREATE TABLE ai_cache (
  key        TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value      TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);

CREATE TABLE stripe_events (
  id          TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL
);
