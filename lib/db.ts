import { env } from "cloudflare:workers";
import type { Bracket, BracketPicks, Game } from "./types";

// ─── Schema migration ─────────────────────────────────────────────────────────

export async function migrate(): Promise<void> {
  await env.DB.exec(`
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
  `);
}

// ─── Bracket queries ──────────────────────────────────────────────────────────

export async function insertBracket(name: string, picks: BracketPicks): Promise<Bracket> {
  const row = await env.DB
    .prepare(`
      INSERT INTO brackets (name, picks_json)
      VALUES (?, ?)
      RETURNING *
    `)
    .bind(name, JSON.stringify(picks))
    .first<BracketRow>();

  if (!row) throw new Error("INSERT brackets returned no row");
  return rowToBracket(row);
}

export async function getBracket(id: number): Promise<Bracket | null> {
  const row = await env.DB
    .prepare("SELECT * FROM brackets WHERE id = ?")
    .bind(id)
    .first<BracketRow>();
  return row ? rowToBracket(row) : null;
}

export async function listBrackets(): Promise<Omit<Bracket, "picks">[]> {
  const { results } = await env.DB
    .prepare("SELECT id, name, created_at, updated_at FROM brackets ORDER BY created_at DESC")
    .all<BracketRow>();
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function deleteBracket(id: number): Promise<boolean> {
  const result = await env.DB
    .prepare("DELETE FROM brackets WHERE id = ?")
    .bind(id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

// ─── Game queries ─────────────────────────────────────────────────────────────

export async function upsertGame(game: Omit<Game, "id">): Promise<void> {
  await env.DB
    .prepare(`
      INSERT INTO games (espn_id, round, region, team_a, team_b, seed_a, seed_b,
                         score_a, score_b, status, winner, game_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT (espn_id) DO UPDATE SET
        score_a    = excluded.score_a,
        score_b    = excluded.score_b,
        status     = excluded.status,
        winner     = excluded.winner,
        updated_at = excluded.updated_at
    `)
    .bind(
      game.espnId, game.round, game.region,
      game.teamA, game.teamB, game.seedA, game.seedB,
      game.scoreA, game.scoreB, game.status, game.winner, game.gameDate,
    )
    .run();
}

export async function listGames(liveOnly = false): Promise<Game[]> {
  const sql = liveOnly
    ? "SELECT * FROM games WHERE status = 'in' ORDER BY game_date"
    : "SELECT * FROM games ORDER BY game_date";
  const { results } = await env.DB.prepare(sql).all<GameRow>();
  return results.map(rowToGame);
}

export async function listFinalGames(): Promise<Game[]> {
  const { results } = await env.DB
    .prepare("SELECT * FROM games WHERE status = 'post'")
    .all<GameRow>();
  return results.map(rowToGame);
}

// ─── Row types ────────────────────────────────────────────────────────────────

interface BracketRow {
  id: number;
  name: string;
  picks_json: string;
  created_at: string;
  updated_at: string;
}

interface GameRow {
  id: number;
  espn_id: string;
  round: string;
  region: string;
  team_a: string;
  team_b: string;
  seed_a: number | null;
  seed_b: number | null;
  score_a: number | null;
  score_b: number | null;
  status: string;
  winner: string | null;
  game_date: string | null;
  updated_at: string;
}

function rowToBracket(r: BracketRow): Bracket {
  return {
    id: r.id,
    name: r.name,
    picks: JSON.parse(r.picks_json) as BracketPicks,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToGame(r: GameRow): Game {
  return {
    id: r.id,
    espnId: r.espn_id,
    round: r.round as Game["round"],
    region: r.region as Game["region"],
    teamA: r.team_a,
    teamB: r.team_b,
    seedA: r.seed_a ?? 0,
    seedB: r.seed_b ?? 0,
    scoreA: r.score_a,
    scoreB: r.score_b,
    status: r.status as Game["status"],
    winner: r.winner,
    gameDate: r.game_date ?? "",
    updatedAt: r.updated_at,
  };
}
