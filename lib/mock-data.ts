/**
 * Mock tournament data for BracketViewer development and testing.
 * Uses a realistic (but fictional) 2024 NCAA Tournament bracket structure.
 * All data is hardcoded — no API dependency needed.
 */

import type { BracketPicks, Game } from "@/lib/types";

// ─── Helper ───────────────────────────────────────────────────────────────────

let _id = 1;
function game(
  espnId: string,
  round: Game["round"],
  region: Game["region"],
  teamA: string,
  seedA: number,
  teamB: string,
  seedB: number,
  status: Game["status"],
  scoreA: number | null,
  scoreB: number | null,
  winner: string | null,
): Game {
  return {
    id: _id++,
    espnId,
    round,
    region,
    teamA,
    seedA,
    teamB,
    seedB,
    scoreA,
    scoreB,
    status,
    winner,
    gameDate: "2024-03-21",
    updatedAt: new Date().toISOString(),
  };
}

// ─── Round of 64 ─────────────────────────────────────────────────────────────
// Each region: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15

export const MOCK_GAMES: Game[] = [
  // ── East ──────────────────────────────────────────────────────────────────
  game("e-r1-1",  "round1", "East", "UConn",         1, "Stetson",        16, "post", 91, 52,  "UConn"),
  game("e-r1-2",  "round1", "East", "FAU",            8, "Northwestern",   9,  "post", 78, 69,  "FAU"),
  game("e-r1-3",  "round1", "East", "San Diego St",  5, "UAB",            12, "post", 69, 68,  "San Diego St"),
  game("e-r1-4",  "round1", "East", "Auburn",         4, "Yale",           13, "post", 83, 72,  "Auburn"),
  game("e-r1-5",  "round1", "East", "BYU",            6, "Duquesne",       11, "post", 76, 72,  "BYU"),
  game("e-r1-6",  "round1", "East", "Illinois",       3, "Morehead St",    14, "post", 85, 69,  "Illinois"),
  game("e-r1-7",  "round1", "East", "Washington St",  7, "Drake",          10, "post", 60, 56,  "Washington St"),
  game("e-r1-8",  "round1", "East", "Iowa St",        2, "South Dakota St",15, "post", 82, 67,  "Iowa St"),

  // ── West ──────────────────────────────────────────────────────────────────
  game("w-r1-1",  "round1", "West", "North Carolina",  1, "Wagner",         16, "post", 90, 62,  "North Carolina"),
  game("w-r1-2",  "round1", "West", "Mississippi St",  8, "Michigan St",    9,  "post", 67, 69,  "Michigan St"),
  game("w-r1-3",  "round1", "West", "St Mary's",       5, "Grand Canyon",   12, "post", 74, 60,  "St Mary's"),
  game("w-r1-4",  "round1", "West", "Alabama",         4, "Charleston",     13, "post", 72, 64,  "Alabama"),
  game("w-r1-5",  "round1", "West", "Clemson",         6, "New Mexico",     11, "post", 71, 64,  "Clemson"),
  game("w-r1-6",  "round1", "West", "Baylor",          3, "Colgate",        14, "post", 88, 63,  "Baylor"),
  game("w-r1-7",  "round1", "West", "Dayton",          7, "Nevada",         10, "post", 63, 60,  "Dayton"),
  game("w-r1-8",  "round1", "West", "Arizona",         2, "Long Beach St",  15, "post", 86, 58,  "Arizona"),

  // ── South ─────────────────────────────────────────────────────────────────
  game("s-r1-1",  "round1", "South", "Houston",       1, "Longwood",       16, "post", 86, 46,  "Houston"),
  game("s-r1-2",  "round1", "South", "Nebraska",      8, "Texas A&M",       9, "post", 67, 72,  "Texas A&M"),
  game("s-r1-3",  "round1", "South", "Wisconsin",     5, "James Madison",  12, "post", 56, 64,  "James Madison"),
  game("s-r1-4",  "round1", "South", "Duke",          4, "Vermont",        13, "post", 64, 47,  "Duke"),
  game("s-r1-5",  "round1", "South", "Texas Tech",    6, "NC State",       11, "post", 70, 79,  "NC State"),
  game("s-r1-6",  "round1", "South", "Kentucky",      3, "Oakland",        14, "post", 75, 80,  "Oakland"),
  game("s-r1-7",  "round1", "South", "Florida",       7, "Colorado",       10, "post", 67, 62,  "Florida"),
  game("s-r1-8",  "round1", "South", "Marquette",     2, "Western Kentucky",15,"post", 87, 69,  "Marquette"),

  // ── Midwest ───────────────────────────────────────────────────────────────
  game("m-r1-1",  "round1", "Midwest", "Purdue",       1, "Montana St",    16, "post", 98, 65,  "Purdue"),
  game("m-r1-2",  "round1", "Midwest", "Utah St",      8, "TCU",            9, "post", 88, 72,  "Utah St"),
  game("m-r1-3",  "round1", "Midwest", "Gonzaga",      5, "McNeese",       12, "post", 86, 65,  "Gonzaga"),
  game("m-r1-4",  "round1", "Midwest", "Kansas",       4, "Samford",       13, "post", 93, 64,  "Kansas"),
  game("m-r1-5",  "round1", "Midwest", "South Carolina",6,"Oregon",        11, "post", 72, 67,  "South Carolina"),
  game("m-r1-6",  "round1", "Midwest", "Creighton",    3, "Akron",         14, "post", 85, 66,  "Creighton"),
  game("m-r1-7",  "round1", "Midwest", "Oregon",       7, "South Carolina", 10,"post", 67, 72,  "South Carolina"),
  game("m-r1-8",  "round1", "Midwest", "Tennessee",    2, "Saint Peter's", 15, "post", 94, 62,  "Tennessee"),

  // ─── Round of 32 ──────────────────────────────────────────────────────────

  // ── East ──────────────────────────────────────────────────────────────────
  game("e-r2-1",  "round2", "East", "UConn",        1, "FAU",            8,  "post", 82, 52,  "UConn"),
  game("e-r2-2",  "round2", "East", "San Diego St", 5, "Auburn",         4,  "post", 69, 73,  "Auburn"),
  game("e-r2-3",  "round2", "East", "Illinois",     3, "BYU",            6,  "post", 89, 68,  "Illinois"),
  game("e-r2-4",  "round2", "East", "Iowa St",      2, "Washington St",  7,  "post", 69, 57,  "Iowa St"),

  // ── West ──────────────────────────────────────────────────────────────────
  game("w-r2-1",  "round2", "West", "North Carolina", 1, "Michigan St",  9,  "post", 90, 63,  "North Carolina"),
  game("w-r2-2",  "round2", "West", "Alabama",        4, "St Mary's",    5,  "post", 89, 77,  "Alabama"),
  game("w-r2-3",  "round2", "West", "Baylor",         3, "Clemson",      6,  "post", 72, 86,  "Clemson"),
  game("w-r2-4",  "round2", "West", "Arizona",        2, "Dayton",       7,  "post", 85, 65,  "Arizona"),

  // ── South ─────────────────────────────────────────────────────────────────
  game("s-r2-1",  "round2", "South", "Houston",      1, "Texas A&M",    9,  "post", 100,75,  "Houston"),
  game("s-r2-2",  "round2", "South", "Duke",         4, "James Madison",12, "post", 93, 55,  "Duke"),
  game("s-r2-3",  "round2", "South", "NC State",    11, "Oakland",      14, "post", 79, 73,  "NC State"),
  game("s-r2-4",  "round2", "South", "Marquette",    2, "Florida",       7, "post", 80, 68,  "Marquette"),

  // ── Midwest ───────────────────────────────────────────────────────────────
  game("m-r2-1",  "round2", "Midwest", "Purdue",       1, "Utah St",       8, "post", 106, 67, "Purdue"),
  game("m-r2-2",  "round2", "Midwest", "Gonzaga",      5, "Kansas",        4, "post", 89,  68, "Gonzaga"),
  game("m-r2-3",  "round2", "Midwest", "Creighton",    3, "South Carolina",6, "post", 77,  63, "Creighton"),
  game("m-r2-4",  "round2", "Midwest", "Tennessee",    2, "South Carolina",10,"post", 94,  82, "Tennessee"),

  // ─── Sweet 16 ─────────────────────────────────────────────────────────────

  // ── East ──────────────────────────────────────────────────────────────────
  game("e-s16-1", "sweet16", "East", "UConn",    1, "Auburn",    4, "post", 77, 52,  "UConn"),
  game("e-s16-2", "sweet16", "East", "Iowa St",  2, "Illinois",  3, "post", 75, 66,  "Iowa St"),

  // ── West ──────────────────────────────────────────────────────────────────
  game("w-s16-1", "sweet16", "West", "North Carolina", 1, "Alabama",  4, "post", 81, 78,  "North Carolina"),
  game("w-s16-2", "sweet16", "West", "Arizona",        2, "Clemson",  6, "post", 77, 72,  "Arizona"),

  // ── South ─────────────────────────────────────────────────────────────────
  game("s-s16-1", "sweet16", "South", "Houston",   1, "Duke",      4, "post", 76, 71,  "Houston"),
  game("s-s16-2", "sweet16", "South", "Marquette", 2, "NC State", 11, "post", 64, 67,  "NC State"),

  // ── Midwest ───────────────────────────────────────────────────────────────
  game("m-s16-1", "sweet16", "Midwest", "Purdue",    1, "Gonzaga",    5, "post", 93, 79,  "Purdue"),
  game("m-s16-2", "sweet16", "Midwest", "Tennessee", 2, "Creighton", 3,  "post", 82, 75,  "Tennessee"),

  // ─── Elite Eight ──────────────────────────────────────────────────────────

  game("e-e8",    "elite8",  "East",    "UConn",          1, "Iowa St",        2,  "post", 72, 65,  "UConn"),
  game("w-e8",    "elite8",  "West",    "North Carolina",  1, "Arizona",        2,  "post", 89, 77,  "North Carolina"),
  game("s-e8",    "elite8",  "South",   "Houston",         1, "NC State",      11,  "post", 66, 72,  "NC State"),
  game("m-e8",    "elite8",  "Midwest", "Purdue",          1, "Tennessee",      2,  "post", 72, 66,  "Purdue"),

  // ─── Final Four ───────────────────────────────────────────────────────────

  game("f4-1",    "final4",  "Final Four", "UConn",         1, "North Carolina", 1, "post", 77, 59,  "UConn"),
  game("f4-2",    "final4",  "Final Four", "NC State",     11, "Purdue",         1, "in",   68, 71,  null),

  // ─── Championship ─────────────────────────────────────────────────────────

  // Not played yet — will be UConn vs winner of NC State/Purdue
  game("champ",   "championship", "Championship", "UConn", 1, "Purdue", 1, "pre", null, null, null),
];

// ─── Mock picks ───────────────────────────────────────────────────────────────
// "User" got most things right through E8, took NC State as a bracket buster

export const MOCK_PICKS: BracketPicks = {
  regions: {
    East: {
      round1:  ["UConn", "FAU", "San Diego St", "Auburn", "BYU", "Illinois", "Washington St", "Iowa St"],
      round2:  ["UConn", "Auburn", "Illinois", "Iowa St"],
      sweet16: ["UConn", "Iowa St"],
      elite8:  "UConn",
    },
    West: {
      round1:  ["North Carolina", "Michigan St", "St Mary's", "Alabama", "Clemson", "Baylor", "Dayton", "Arizona"],
      round2:  ["North Carolina", "Alabama", "Baylor", "Arizona"],
      sweet16: ["North Carolina", "Arizona"],
      elite8:  "Arizona",       // Wrong — NC won
    },
    South: {
      round1:  ["Houston", "Texas A&M", "Wisconsin", "Duke", "NC State", "Kentucky", "Florida", "Marquette"],
      round2:  ["Houston", "Duke", "NC State", "Marquette"],
      sweet16: ["Houston", "Marquette"],
      elite8:  "Houston",       // Wrong — NC State won (upset!)
    },
    Midwest: {
      round1:  ["Purdue", "Utah St", "Gonzaga", "Kansas", "South Carolina", "Creighton", "Oregon", "Tennessee"],
      round2:  ["Purdue", "Gonzaga", "Creighton", "Tennessee"],
      sweet16: ["Purdue", "Tennessee"],
      elite8:  "Purdue",
    },
  },
  final4:   ["UConn", "Arizona", "Houston", "Purdue"],
  champion: "UConn",
};
