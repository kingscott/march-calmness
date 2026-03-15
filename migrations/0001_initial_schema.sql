CREATE TABLE IF NOT EXISTS brackets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  picks_json TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  espn_id    TEXT    UNIQUE NOT NULL,
  round      TEXT    NOT NULL,
  region     TEXT    NOT NULL,
  team_a     TEXT    NOT NULL,
  team_b     TEXT    NOT NULL,
  seed_a     INTEGER,
  seed_b     INTEGER,
  score_a    INTEGER,
  score_b    INTEGER,
  status     TEXT    NOT NULL DEFAULT 'pre',
  winner     TEXT,
  game_date  TEXT,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
