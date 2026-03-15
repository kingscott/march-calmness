// ─── Tournament structure ────────────────────────────────────────────────────

export type Region = "East" | "West" | "South" | "Midwest";

export type Round =
  | "round1"   // Round of 64
  | "round2"   // Round of 32
  | "sweet16"
  | "elite8"
  | "final4"
  | "championship";

export const ROUND_POINTS: Record<Round, number> = {
  round1: 10,
  round2: 20,
  sweet16: 40,
  elite8: 80,
  final4: 160,
  championship: 320,
};

// ─── Bracket picks (user's selections) ──────────────────────────────────────

export interface RegionPicks {
  round1: string[];    // 8 winners
  round2: string[];    // 4 winners
  sweet16: string[];   // 2 winners
  elite8: string;      // 1 regional champion
}

export interface BracketPicks {
  regions: Record<Region, RegionPicks>;
  final4: string[];    // 4 teams (2 from each semifinal)
  champion: string;
}

export interface Bracket {
  id: number;
  name: string;
  picks: BracketPicks;
  createdAt: string;
  updatedAt: string;
}

// ─── Game results (from ESPN) ────────────────────────────────────────────────

export type GameStatus = "pre" | "in" | "post";

export interface Game {
  id: number;
  espnId: string;
  round: Round;
  region: Region | "Final Four" | "Championship";
  teamA: string;
  teamB: string;
  seedA: number;
  seedB: number;
  scoreA: number | null;
  scoreB: number | null;
  status: GameStatus;
  winner: string | null;
  gameDate: string;
  updatedAt: string;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export interface PickResult {
  team: string;
  round: Round;
  region: Game["region"];
  status: "correct" | "eliminated" | "pending";
  points: number;
}

export interface BracketScore {
  bracketId: number;
  bracketName: string;
  totalPoints: number;
  maxPossible: number;
  correctPicks: number;
  eliminatedPicks: number;
  pendingPicks: number;
  picks: PickResult[];
}

// ─── API response shapes ─────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}

export interface UploadResponse {
  bracket: Bracket;
}

export interface BracketListResponse {
  brackets: Omit<Bracket, "picks">[];
}
