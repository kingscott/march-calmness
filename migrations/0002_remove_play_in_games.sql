-- Remove First Four (play-in) games that were incorrectly stored as round1.
-- Play-in games are the only matchups where both competitors share the same seed.
DELETE FROM games WHERE seed_a = seed_b;
