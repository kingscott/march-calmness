import Link from "next/link";
import { listBrackets } from "@/lib/db";
import type { Bracket } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const brackets = await listBrackets();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[1.75rem] font-semibold text-[var(--text-primary)] mb-1">
            Dashboard
          </h1>
          <p className="text-[var(--text-secondary)]">
            {brackets.length === 0
              ? "No brackets yet."
              : `${brackets.length} bracket${brackets.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link href="/upload" className="btn btn-primary">
          Upload PDF
        </Link>
      </div>

      {brackets.length === 0 ? (
        <EmptyState />
      ) : (
        <BracketList brackets={brackets} />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="card text-center py-16 flex flex-col items-center gap-4">
      <BracketIcon />
      <div>
        <p className="text-[var(--text-primary)] font-medium mb-1">No brackets yet</p>
        <p className="text-[var(--text-secondary)] text-sm">
          Upload a filled-in bracket PDF and Claude will extract your picks.
        </p>
      </div>
      <Link href="/upload" className="btn btn-primary mt-2">
        Upload a PDF
      </Link>
    </div>
  );
}

// ─── Bracket list ─────────────────────────────────────────────────────────────

function BracketList({ brackets }: { brackets: Omit<Bracket, "picks">[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {brackets.map((b) => (
        <BracketRow key={b.id} bracket={b} />
      ))}
    </ul>
  );
}

function BracketRow({ bracket }: { bracket: Omit<Bracket, "picks"> }) {
  const created = new Date(bracket.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li className="card flex items-center justify-between gap-4 py-4 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className="shrink-0 w-10 h-10 rounded-[var(--radius-btn)] flex items-center justify-center text-[var(--accent)]"
          style={{ background: "var(--accent-dim)" }}
        >
          <BracketIcon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[var(--text-primary)] font-medium truncate">{bracket.name}</p>
          <p className="text-[var(--text-secondary)] text-sm">Uploaded {created}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/bracket?id=${bracket.id}`}
          className="btn btn-ghost text-sm py-1.5 px-3"
        >
          View picks
        </Link>
        <DeleteButton bracketId={bracket.id} bracketName={bracket.name} />
      </div>
    </li>
  );
}

// ─── Delete button (client island) ───────────────────────────────────────────

import DeleteButton from "@/components/DeleteButton";

// ─── Icons ────────────────────────────────────────────────────────────────────

function BracketIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="5" rx="1" />
      <rect x="3" y="11" width="7" height="5" rx="1" />
      <rect x="14" y="7" width="7" height="5" rx="1" />
      <path d="M10 5.5h2a2 2 0 012 2v1" />
      <path d="M10 13.5h2a2 2 0 002-2v-1" />
    </svg>
  );
}
