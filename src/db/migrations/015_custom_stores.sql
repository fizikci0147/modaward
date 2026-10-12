-- Stores a person added themselves (a shop that is not in the built-in database). Private to the person: they are only
-- ever used to build that person's own shopping links. `search` is an optional search-page URL containing {q}.
CREATE TABLE custom_stores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  domain     TEXT    NOT NULL,
  search     TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, domain)
);
CREATE INDEX idx_custom_stores_user ON custom_stores(user_id);
