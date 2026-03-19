"use client";

/**
 * Development-only page for testing BracketViewer with hardcoded mock data.
 * No API calls — useful for iterating on the visualization without a live server.
 *
 * Visit: /bracket/mock
 */

import { useState } from "react";
import Link from "next/link";
import BracketViewer from "@/components/BracketViewer";
import { MOCK_GAMES, MOCK_PICKS } from "@/lib/mock-data";
import type { BracketPicks, Game, Region, Round } from "@/lib/types";

type Scenario = "all-final" | "in-progress" | "pre-tournament" | "no-games";

const SCENARIO_LABELS: Record<Scenario, string> = {
  "all-final":      "All games final",
  "in-progress":    "Tournament in progress (with live game)",
  "pre-tournament": "Pre-tournament (all pre)",
  "no-games":       "No game data (picks-only fallback)",
};

function applyScenario(games: Game[], scenario: Scenario): Game[] {
  switch (scenario) {
    case "all-final":
      // Make the F4 game final with a winner, championship also played
      return games.map((g) => {
        if (g.espnId === "f4-2") {
          return { ...g, status: "post", scoreA: 68, scoreB: 74, winner: "Purdue" };
        }
        if (g.espnId === "champ") {
          return { ...g, status: "post", scoreA: 75, scoreB: 60, winner: "UConn", teamB: "Purdue" };
        }
        return g;
      });

    case "in-progress":
      // F4 game is live; championship not yet determined
      return games.filter((g) => g.espnId !== "champ");

    case "pre-tournament":
      // All games have pre status, no scores
      return games.map((g) => ({
        ...g,
        status: "pre" as const,
        scoreA: null,
        scoreB: null,
        winner: null,
      }));

    case "no-games":
      return [];

    default:
      return games;
  }
}

function scorePicksAgainstGames(picks: BracketPicks, games: Game[]) {
  if (games.length === 0) return { correct: 0, eliminated: 0, pending: 0 };
  let correct = 0, eliminated = 0, pending = 0;
  function check(team: string, round: Round, region: Game["region"]) {
    const game = games.find(
      (g) => g.round === round && g.region === region && (g.teamA === team || g.teamB === team),
    );
    if (!game || game.status !== "post") { pending++; return; }
    if (game.winner === team) correct++;
    else eliminated++;
  }
  const REGIONS: Region[] = ["East", "West", "South", "Midwest"];
  for (const region of REGIONS) {
    const rp = picks.regions[region];
    for (const t of rp.round1)  check(t, "round1",  region);
    for (const t of rp.round2)  check(t, "round2",  region);
    for (const t of rp.sweet16) check(t, "sweet16", region);
    check(rp.elite8, "elite8", region);
  }
  for (const t of picks.final4) check(t, "final4", "Final Four");
  check(picks.champion, "championship", "Championship");
  return { correct, eliminated, pending };
}

export default function MockBracketPage() {
  const [scenario, setScenario] = useState<Scenario>("in-progress");

  const games = applyScenario(MOCK_GAMES, scenario);
  const liveCount = games.filter((g) => g.status === "in").length;
  const score = scorePicksAgainstGames(MOCK_PICKS, games);
  const total = score.correct + score.eliminated + score.pending;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/"
            className="text-[var(--text-secondary)] text-sm hover:text-[var(--accent)] transition-colors mb-1 block"
          >
            ← Dashboard
          </Link>
          <h1 className="text-[1.75rem] font-semibold text-[var(--text-primary)]">
            Bracket Viewer — Mock Data
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">
            Dev page — uses hardcoded fixture data, no API calls
          </p>
        </div>

        <div className="flex items-center gap-3">
          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--accent)]">
              <span
                className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]"
                style={{ animation: "breathe 2.4s ease-in-out infinite" }}
              />
              {liveCount} live
            </span>
          )}
        </div>
      </div>

      {/* Scenario switcher */}
      <div className="card p-4 mb-6">
        <p className="text-xs text-[var(--text-secondary)] mb-3 uppercase tracking-wider font-medium">
          Test scenario
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCENARIO_LABELS) as Scenario[]).map((s) => (
            <button
              key={s}
              onClick={() => setScenario(s)}
              className={`btn text-sm py-1.5 px-3 ${
                scenario === s ? "btn-primary" : "btn-ghost"
              }`}
            >
              {SCENARIO_LABELS[s]}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-3">
          <span className="text-[var(--text-primary)]">{games.length}</span> games loaded
          {liveCount > 0 && (
            <>, <span className="text-[var(--accent)]">{liveCount} live</span></>
          )}
        </p>
      </div>

      {/* Score bar */}
      {games.length > 0 && (
        <div className="card flex items-center gap-6 py-3 px-5 mb-5">
          <div className="flex gap-5 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#7eb89a]" />
              <span className="text-[var(--text-primary)] font-medium">{score.correct}</span>
              <span className="text-[var(--text-secondary)]">correct</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#c47a7a]" />
              <span className="text-[var(--text-primary)] font-medium">{score.eliminated}</span>
              <span className="text-[var(--text-secondary)]">out</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#6b7280]" />
              <span className="text-[var(--text-primary)] font-medium">{score.pending}</span>
              <span className="text-[var(--text-secondary)]">pending</span>
            </span>
          </div>
          {total > 0 && (
            <>
              <div className="w-px h-8 bg-[var(--border)]" />
              <div className="flex-1 min-w-[120px]">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--surface-hover)]">
                  <div className="bg-[#7eb89a] transition-all duration-500" style={{ width: `${(score.correct / total) * 100}%` }} />
                  <div className="bg-[#c47a7a] transition-all duration-500" style={{ width: `${(score.eliminated / total) * 100}%` }} />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {score.correct} of {total} picks decided
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mb-5 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#7eb89a]" />
          Correct pick
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#c47a7a]" />
          Eliminated
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#e2c2a2]" />
          Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#6b7280]" />
          Not picked
        </span>
      </div>

      {/* Bracket */}
      <BracketViewer picks={MOCK_PICKS} games={games} />
    </div>
  );
}
