"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import BracketViewer from "@/components/BracketViewer";
import type { Bracket, BracketPicks, Game, Region, Round } from "@/lib/types";

// ─── Fetcher ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetcher = (url: string): Promise<any> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// ─── Page (exported with Suspense wrapper for useSearchParams) ────────────────

export default function BracketPage() {
  return (
    <Suspense
      fallback={
        <div>
          <div className="h-8 w-48 bg-[var(--surface-hover)] rounded animate-pulse mb-2" />
          <div className="h-5 w-32 bg-[var(--surface-hover)] rounded animate-pulse mb-8" />
          <div className="card py-32 flex items-center justify-center">
            <p className="text-[var(--text-secondary)]">Loading bracket…</p>
          </div>
        </div>
      }
    >
      <BracketPageInner />
    </Suspense>
  );
}

// ─── Score calculation ────────────────────────────────────────────────────────

interface ScoreSummary {
  correct: number;
  eliminated: number;
  pending: number;
}

function scorePicksAgainstGames(picks: BracketPicks, games: Game[]): ScoreSummary {
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

// ─── Inner page (uses useSearchParams — must be inside Suspense) ──────────────

function BracketPageInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const {
    data: bracketData,
    error: bracketError,
    isLoading: bracketLoading,
  } = useSWR<Bracket>(id ? `/api/bracket/${id}` : null, fetcher);

  const { data: scoresData } = useSWR<{ games: Game[] }>(
    "/api/scores",
    fetcher,
    { refreshInterval: 30_000 },
  );

  const games: Game[] = scoresData?.games ?? [];

  // ── No bracket selected ────────────────────────────────────────────────────

  if (!id) {
    return (
      <div>
        <h1 className="text-[1.75rem] font-semibold text-[var(--text-primary)] mb-2">
          Bracket
        </h1>
        <div className="card text-center py-12">
          <p className="text-[var(--text-secondary)]">
            No bracket selected.{" "}
            <Link href="/" className="text-[var(--accent)] hover:underline">
              Pick one from the dashboard
            </Link>{" "}
            or{" "}
            <Link href="/upload" className="text-[var(--accent)] hover:underline">
              upload a PDF
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (bracketLoading) {
    return (
      <div>
        <div className="h-8 w-48 bg-[var(--surface-hover)] rounded animate-pulse mb-2" />
        <div className="h-5 w-32 bg-[var(--surface-hover)] rounded animate-pulse mb-8" />
        <div className="card py-32 flex items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading bracket…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (bracketError || !bracketData) {
    return (
      <div>
        <h1 className="text-[1.75rem] font-semibold text-[var(--text-primary)] mb-2">
          Bracket
        </h1>
        <div className="card text-center py-12">
          <p className="text-[var(--text-secondary)] mb-3">
            {bracketError?.message ?? "Bracket not found."}
          </p>
          <Link href="/" className="btn btn-ghost text-sm">
            ← Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Bracket ────────────────────────────────────────────────────────────────

  const liveCount = games.filter((g) => g.status === "in").length;
  const score = scorePicksAgainstGames(bracketData.picks, games);
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
            {bracketData.name}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--accent)]">
              <span className="live-pulse" />
              {liveCount} live
            </span>
          )}
          <span className="text-xs text-[var(--text-secondary)]">
            Auto-updates every 30s
          </span>
        </div>
      </div>

      {/* Score bar — only shown once games are available */}
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
                  <div
                    className="bg-[#7eb89a] transition-all duration-500"
                    style={{ width: `${(score.correct / total) * 100}%` }}
                  />
                  <div
                    className="bg-[#c47a7a] transition-all duration-500"
                    style={{ width: `${(score.eliminated / total) * 100}%` }}
                  />
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

      {/* Bracket visualization */}
      <BracketViewer picks={bracketData.picks} games={games} />
    </div>
  );
}
