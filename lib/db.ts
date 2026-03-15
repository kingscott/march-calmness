import { createRequire } from "module";
import path from "path";
import type BetterSqlite3 from "better-sqlite3";
import type { Bracket, BracketPicks, Game } from "./types";

// better-sqlite3 uses `bindings` which relies on __filename to locate the
// native .node binary. In Vite/vinext ESM contexts __filename is undefined,
// so we load it via a CJS require() scoped to this file's URL instead.
const _require = createRequire(import.meta.url);
const SqliteDatabase = _require("better-sqlite3") as typeof BetterSqlite3;

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");

let _db: BetterSqlite3.Database | null = null;

export function getDb(): BetterSqlite3.Database {
  if (_db) return _db;
  _db = new SqliteDatabase(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: BetterSqlite3.Database) {
  db.exec(`
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

export function insertBracket(name: string, picks: BracketPicks): Bracket {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO brackets (name, picks_json)
    VALUES (@name, @picks_json)
    RETURNING *
  `);
  const row = stmt.get({ name, picks_json: JSON.stringify(picks) }) as BracketRow;
  return rowToBracket(row);
}

export function getBracket(id: number): Bracket | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM brackets WHERE id = ?").get(id) as BracketRow | undefined;
  return row ? rowToBracket(row) : null;
}

export function listBrackets(): Omit<Bracket, "picks">[] {
  const db = getDb();
  const rows = db.prepare("SELECT id, name, created_at, updated_at FROM brackets ORDER BY created_at DESC").all() as BracketRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function deleteBracket(id: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM brackets WHERE id = ?").run(id);
  return result.changes > 0;
}

// ─── Game queries ─────────────────────────────────────────────────────────────

export function upsertGame(game: Omit<Game, "id">): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO games (espn_id, round, region, team_a, team_b, seed_a, seed_b,
                       score_a, score_b, status, winner, game_date, updated_at)
    VALUES (@espnId, @round, @region, @teamA, @teamB, @seedA, @seedB,
            @scoreA, @scoreB, @status, @winner, @gameDate, datetime('now'))
    ON CONFLICT (espn_id) DO UPDATE SET
      score_a    = excluded.score_a,
      score_b    = excluded.score_b,
      status     = excluded.status,
      winner     = excluded.winner,
      updated_at = excluded.updated_at
  `).run(game);
}

export function listGames(liveOnly = false): Game[] {
  const db = getDb();
  const sql = liveOnly
    ? "SELECT * FROM games WHERE status = 'in' ORDER BY game_date"
    : "SELECT * FROM games ORDER BY game_date";
  const rows = db.prepare(sql).all() as GameRow[];
  return rows.map(rowToGame);
}

export function listFinalGames(): Game[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM games WHERE status = 'post'").all() as GameRow[];
  return rows.map(rowToGame);
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

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
