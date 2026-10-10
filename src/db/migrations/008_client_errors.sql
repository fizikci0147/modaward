-- Errors the app's own code hits in people's browsers, so problems are found before anyone has to report them.
CREATE TABLE client_errors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  build      TEXT    NOT NULL,
  path       TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  stack      TEXT    NOT NULL DEFAULT '',
  agent      TEXT    NOT NULL DEFAULT '',
  user_id    TEXT    REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_client_errors_time ON client_errors(created_at);
