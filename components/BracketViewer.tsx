"use client";

import { useEffect, useRef } from "react";
import type { BracketPicks, Game, Region, Round } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BracketViewerProps {
  picks: BracketPicks;
  games: Game[];
}

type PickStatus = "correct" | "eliminated" | "pending";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUND_KEY_TO_INDEX: Record<string, number> = {
  round1: 0,
  round2: 1,
  sweet16: 2,
  elite8: 3,
  final4: 4,
  championship: 5,
};

const ROUND_INDEX_TO_KEY: Record<number, string> = {
  0: "round1",
  1: "round2",
  2: "sweet16",
  3: "elite8",
  4: "final4",
  5: "championship",
};

const REGION_BLOCK: Record<string, number> = {
  East: 0,
  West: 1,
  South: 2,
  Midwest: 3,
};

// Standard R64 bracket positions by the lower seed in the matchup
const TOP_SEED_R64_POSITION: Record<number, number> = {
  1: 0,
  8: 1,
  5: 2,
  4: 3,
  6: 4,
  3: 5,
  7: 6,
  2: 7,
};

// Which quadrant of the region bracket each seed belongs to
const SEED_QUADRANT: Record<number, number> = {
  1: 0, 16: 0, 8: 0, 9: 0,
  5: 1, 12: 1, 4: 1, 13: 1,
  6: 2, 11: 2, 3: 2, 14: 2,
  7: 3, 10: 3, 2: 3, 15: 3,
};

// ─── Pick status helpers ──────────────────────────────────────────────────────

function buildPickStatusMap(
  picks: BracketPicks,
  games: Game[],
): Map<string, PickStatus> {
  const map = new Map<string, PickStatus>();
  const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

  for (const region of REGIONS) {
    const rp = picks.regions[region];

    for (const round of ["round1", "round2", "sweet16"] as const) {
      for (const team of rp[round]) {
        map.set(`${team}:${round}`, getRegionalStatus(games, round, region, team));
      }
    }

    map.set(
      `${rp.elite8}:elite8`,
      getRegionalStatus(games, "elite8", region, rp.elite8),
    );
  }

  for (const team of picks.final4) {
    map.set(`${team}:final4`, getF4Status(games, team));
  }

  map.set(`${picks.champion}:championship`, getChampStatus(games, picks.champion));

  return map;
}

function findGame(
  games: Game[],
  round: Round,
  region: Game["region"],
  team: string,
): Game | undefined {
  return games.find(
    (g) =>
      g.round === round &&
      g.region === region &&
      (g.teamA === team || g.teamB === team),
  );
}

function getRegionalStatus(
  games: Game[],
  round: Round,
  region: Region,
  team: string,
): PickStatus {
  const game = findGame(games, round, region, team);
  if (!game || game.status !== "post") return "pending";
  return game.winner === team ? "correct" : "eliminated";
}

function getF4Status(games: Game[], team: string): PickStatus {
  const f4Game = games.find(
    (g) => g.round === "final4" && (g.teamA === team || g.teamB === team),
  );

  if (!f4Game) {
    // Team didn't make Final Four — check if E8 already ended their run
    const e8Loss = games.find(
      (g) =>
        g.round === "elite8" &&
        (g.teamA === team || g.teamB === team) &&
        g.status === "post" &&
        g.winner !== team,
    );
    return e8Loss ? "eliminated" : "pending";
  }

  if (f4Game.status !== "post") return "pending";
  return f4Game.winner === team ? "correct" : "eliminated";
}

function getChampStatus(games: Game[], team: string): PickStatus {
  const game = findGame(games, "championship", "Championship", team);
  if (game?.status === "post") {
    return game.winner === team ? "correct" : "eliminated";
  }
  // Championship game missing/pre/in — a team eliminated in the Final Four
  // can never reach the championship, so propagate that result.
  return getF4Status(games, team) === "eliminated" ? "eliminated" : "pending";
}

// ─── Bracketry data from picks (no game data needed) ─────────────────────────
//
// The picks structure stores only winners at each round. To build Bracketry
// matches we reconstruct each matchup by finding the loser: for round N match i,
// the two contestants are round(N-1)[2i] and round(N-1)[2i+1], and the winner
// is round(N)[i].
//
// Bracket advancement pairing (within each region):
//   round1 [8 winners]  → pairs (0,1),(2,3),(4,5),(6,7)  → round2 [4]
//   round2 [4 winners]  → pairs (0,1),(2,3)               → sweet16 [2]
//   sweet16[2 winners]  → pair  (0,1)                     → elite8 [1]
//   elite8 [1 per region] × 4 regions → final4 [4], then championship [1]
//
// For round1 we don't know the original 64-team field (only the 8 winners per
// region), so those matchups show only one side — the winner — which Bracketry
// renders fine.

function buildBracketryDataFromPicks(picks: BracketPicks) {
  const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

  const rounds = [
    { name: "Round of 64" },
    { name: "Round of 32" },
    { name: "Sweet 16" },
    { name: "Elite Eight" },
    { name: "Final Four" },
    { name: "Championship" },
  ];

  const contestants: Record<string, { players: [{ title: string }] }> = {};
  const matches: object[] = [];

  function ensureContestant(name: string) {
    if (!contestants[name]) {
      contestants[name] = { players: [{ title: name }] };
    }
  }

  function addMatch(
    roundIndex: number,
    order: number,
    sideA: string,
    sideB: string | null, // null = unknown opponent (round1 losers)
    winner: string,
  ) {
    ensureContestant(sideA);
    if (sideB) ensureContestant(sideB);

    const sides = sideB
      ? [
          { contestantId: sideA, isWinner: sideA === winner },
          { contestantId: sideB, isWinner: sideB === winner },
        ]
      : [{ contestantId: sideA, isWinner: true }];

    matches.push({ roundIndex, order, sides });
  }

  for (const region of REGIONS) {
    const rp = picks.regions[region];
    const block = REGION_BLOCK[region];

    // Round of 64 (roundIndex 0): we only know the 8 winners, not who they beat
    // Render each as a single-side match so the winner still appears in the bracket
    for (let i = 0; i < rp.round1.length; i++) {
      addMatch(0, block * 8 + i, rp.round1[i], null, rp.round1[i]);
    }

    // Round of 32 (roundIndex 1): winner at round2[i] beat one of round1[2i] or round1[2i+1]
    for (let i = 0; i < rp.round2.length; i++) {
      const w = rp.round2[i];
      const pair = [rp.round1[2 * i], rp.round1[2 * i + 1]];
      const loser = pair.find((t) => t !== w) ?? pair[1];
      addMatch(1, block * 4 + i, w, loser, w);
    }

    // Sweet 16 (roundIndex 2)
    for (let i = 0; i < rp.sweet16.length; i++) {
      const w = rp.sweet16[i];
      const pair = [rp.round2[2 * i], rp.round2[2 * i + 1]];
      const loser = pair.find((t) => t !== w) ?? pair[1];
      addMatch(2, block * 2 + i, w, loser, w);
    }

    // Elite Eight (roundIndex 3)
    {
      const w = rp.elite8;
      const pair = rp.sweet16;
      const loser = pair.find((t) => t !== w) ?? pair[1];
      addMatch(3, block, w, loser, w);
    }
  }

  // Final Four (roundIndex 4): elite8 winners, paired East/West and South/Midwest
  // East(0) vs West(1) → slot 0; South(2) vs Midwest(3) → slot 1
  const e8Winners = REGIONS.map((r) => picks.regions[r].elite8);
  // pair 0: East vs West
  {
    const [a, b] = [e8Winners[0], e8Winners[1]];
    const w = picks.final4.find((t) => t === a || t === b) ?? a;
    addMatch(4, 0, a, b, w);
  }
  // pair 1: South vs Midwest
  {
    const [a, b] = [e8Winners[2], e8Winners[3]];
    const w = picks.final4.find((t) => t === a || t === b) ?? a;
    addMatch(4, 1, a, b, w);
  }

  // Championship (roundIndex 5)
  {
    const [a, b] = [picks.final4[0] ?? picks.final4[1], picks.final4[1] ?? picks.final4[0]];
    // f4 slot 0 winner vs f4 slot 1 winner
    const f4slot0 = picks.final4.find((t) => t === e8Winners[0] || t === e8Winners[1]) ?? picks.final4[0];
    const f4slot1 = picks.final4.find((t) => t === e8Winners[2] || t === e8Winners[3]) ?? picks.final4[1];
    void a; void b;
    addMatch(5, 0, f4slot0, f4slot1, picks.champion);
  }

  return { rounds, contestants, matches };
}

// ─── Bracketry data builder ───────────────────────────────────────────────────

function getWithinRegionOrder(game: Game): number {
  const topSeed = Math.min(game.seedA || 99, game.seedB || 99);

  switch (game.round) {
    case "round1":
      return TOP_SEED_R64_POSITION[topSeed] ?? 0;
    case "round2":
      return SEED_QUADRANT[topSeed] ?? 0;
    case "sweet16": {
      const q = SEED_QUADRANT[topSeed];
      return q !== undefined ? (q <= 1 ? 0 : 1) : 0;
    }
    case "elite8":
      return 0;
    default:
      return 0;
  }
}

function buildBracketryData(games: Game[]) {
  const rounds = [
    { name: "Round of 64" },
    { name: "Round of 32" },
    { name: "Sweet 16" },
    { name: "Elite Eight" },
    { name: "Final Four" },
    { name: "Championship" },
  ];

  const contestants: Record<string, { players: [{ title: string }] }> = {};
  const matches: object[] = [];

  // Sort F4 games by espnId for a consistent order 0/1
  const f4Games = games
    .filter((g) => g.round === "final4")
    .sort((a, b) => a.espnId.localeCompare(b.espnId));

  const f4OrderMap = new Map(f4Games.map((g, i) => [g.espnId, i]));

  const BLOCK_SIZE: Record<string, number> = {
    round1: 8,
    round2: 4,
    sweet16: 2,
    elite8: 1,
  };

  for (const game of games) {
    for (const name of [game.teamA, game.teamB]) {
      if (!contestants[name]) {
        contestants[name] = { players: [{ title: name }] };
      }
    }

    const roundIndex = ROUND_KEY_TO_INDEX[game.round];
    let order: number;

    if (game.round === "final4") {
      order = f4OrderMap.get(game.espnId) ?? 0;
    } else if (game.round === "championship") {
      order = 0;
    } else {
      const block = REGION_BLOCK[game.region] ?? 0;
      const blockSize = BLOCK_SIZE[game.round] ?? 1;
      order = block * blockSize + getWithinRegionOrder(game);
    }

    matches.push({
      roundIndex,
      order,
      isLive: game.status === "in",
      sides: [
        {
          contestantId: game.teamA,
          isWinner: game.status === "post" && game.winner === game.teamA,
          scores:
            game.scoreA !== null && game.scoreA !== undefined
              ? [{ mainScore: game.scoreA }]
              : [],
        },
        {
          contestantId: game.teamB,
          isWinner: game.status === "post" && game.winner === game.teamB,
          scores:
            game.scoreB !== null && game.scoreB !== undefined
              ? [{ mainScore: game.scoreB }]
              : [],
        },
      ],
    });
  }

  return { rounds, contestants, matches };
}

// ─── Bracketry options builder ────────────────────────────────────────────────

function makePlayerTitleHTML(
  player: { title: string },
  ctx: { roundIndex: number },
  pickMap: Map<string, PickStatus>,
): string {
  const roundKey = ROUND_INDEX_TO_KEY[ctx.roundIndex];
  const key = `${player.title}:${roundKey}`;
  const status = pickMap.get(key);

  const title = player.title.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  if (status === "correct")
    return `<span style="color:#7eb89a;font-weight:600">${title}</span>`;
  if (status === "eliminated")
    return `<span style="color:#c47a7a;text-decoration:line-through">${title}</span>`;
  if (status === "pending")
    return `<span style="color:#e2c2a2">${title}</span>`;

  return `<span style="color:#9ca3af">${title}</span>`;
}

function buildOptions(pickMap: Map<string, PickStatus>) {
  return {
    useClassicalLayout: true,

    // Calm theme
    rootBgColor: "transparent",
    rootBorderColor: "transparent",
    wrapperBorderColor: "rgba(255,255,255,0.08)",
    matchTextColor: "#e8e6e3",
    connectionLinesColor: "rgba(255,255,255,0.15)",
    highlightedConnectionLinesColor: "#e2c2a2",
    roundTitleColor: "#9ca3af",
    roundTitlesBorderColor: "rgba(255,255,255,0.06)",
    liveMatchBorderColor: "#e2c2a2",
    liveMatchBgColor: "rgba(226,194,162,0.06)",
    scrollButtonSvgColor: "#9ca3af",
    navButtonSvgColor: "#9ca3af",

    // Breathing live indicator above each live match
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getMatchTopHTML: (match: any) => {
      if (!match.isLive) return "";
      return `<span style="
        display:inline-flex;align-items:center;gap:4px;
        font-size:10px;color:#e2c2a2;letter-spacing:0.05em;
        text-transform:uppercase;padding:0 2px 2px;
      ">
        <span style="
          display:inline-block;width:6px;height:6px;
          border-radius:50%;background:#e2c2a2;
          animation:breathe 2.4s ease-in-out infinite;
        "></span>
        Live
      </span>`;
    },

    // Pick status coloring
    getPlayerTitleHTML: (
      player: { title: string },
      ctx: { roundIndex: number },
    ) => makePlayerTitleHTML(player, ctx, pickMap),
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BracketViewer({ picks, games }: BracketViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bracketInstanceRef = useRef<any>(null);
  const hasGames = games.length > 0;

  // Mount / full rebuild whenever picks change (or on first render)
  useEffect(() => {
    if (!wrapperRef.current) return;

    // Use real game data when available; fall back to picks-only reconstruction
    const data = hasGames
      ? buildBracketryData(games)
      : buildBracketryDataFromPicks(picks);
    const pickMap = hasGames
      ? buildPickStatusMap(picks, games)
      : new Map<string, PickStatus>();

    let cancelled = false;

    import("bracketry").then(({ createBracket }) => {
      if (cancelled || !wrapperRef.current) return;

      bracketInstanceRef.current?.uninstall();

      bracketInstanceRef.current = createBracket(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data as any,
        wrapperRef.current,
        buildOptions(pickMap),
      );
    });

    return () => {
      cancelled = true;
      bracketInstanceRef.current?.uninstall();
      bracketInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks]);

  // Live score updates — patch options + matches without re-mounting
  useEffect(() => {
    if (!bracketInstanceRef.current || !hasGames) return;

    const pickMap = buildPickStatusMap(picks, games);
    bracketInstanceRef.current.applyNewOptions(buildOptions(pickMap));

    const updatedMatches = buildBracketryData(games).matches;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bracketInstanceRef.current.applyMatchesUpdates(updatedMatches as any);
  }, [games, picks, hasGames]);

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)]">
      <div
        ref={wrapperRef}
        style={{ height: "min(80vh, 720px)", minWidth: "960px" }}
      />
    </div>
  );
}
