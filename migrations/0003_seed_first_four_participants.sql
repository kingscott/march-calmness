-- Seed Round 1 games for First Four participants.
-- These games were absent from the DB because ESPN only populates them after
-- the First Four results are final, and the upsert previously did not update
-- team_a/team_b on conflict. Inserted here as a one-time backfill; the poller
-- will keep them current going forward.

INSERT INTO games (espn_id, round, region, team_a, team_b, seed_a, seed_b,
                   score_a, score_b, status, winner, game_date, updated_at)
VALUES
  -- Tennessee Volunteers (6) vs Miami (OH) RedHawks (11) — Midwest, 2026-03-20
  ('401856527', 'round1', 'Midwest', 'Tennessee Volunteers', 'Miami (OH) RedHawks',
   6, 11, NULL, NULL, 'pre', NULL, '2026-03-20T20:25Z', datetime('now')),
  -- Florida Gators (1) vs Prairie View A&M Panthers (16) — South, 2026-03-20
  ('401856523', 'round1', 'South', 'Florida Gators', 'Prairie View A&M Panthers',
   1, 16, NULL, NULL, 'pre', NULL, '2026-03-21T01:25Z', datetime('now'))
ON CONFLICT (espn_id) DO UPDATE SET
  team_a     = excluded.team_a,
  team_b     = excluded.team_b,
  seed_a     = excluded.seed_a,
  seed_b     = excluded.seed_b,
  updated_at = excluded.updated_at;
