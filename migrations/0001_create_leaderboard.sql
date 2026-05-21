CREATE TABLE IF NOT EXISTS leaderboard (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  length INTEGER NOT NULL,
  mode TEXT NOT NULL,
  time INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_mode_rank
ON leaderboard (mode, score DESC, length DESC, time ASC, created_at ASC);
