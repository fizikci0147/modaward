-- "This piece does not go with that look": the pair (piece, other piece) is never put together
-- again. Each piece stays free to be mixed with everything else.
CREATE TABLE pair_blocks (
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  a          TEXT    NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  b          TEXT    NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, a, b)
) WITHOUT ROWID;
CREATE INDEX idx_pair_blocks_b ON pair_blocks(user_id, b);
