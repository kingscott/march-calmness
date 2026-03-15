export default function BracketPage() {
  return (
    <div>
      <h1 className="text-[1.75rem] font-semibold text-[var(--text-primary)] mb-2">
        Bracket
      </h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Live bracket visualization coming soon.
      </p>

      <div className="card text-center py-12">
        <p className="text-[var(--text-secondary)]">
          No bracket loaded.{" "}
          <a href="/upload" className="text-[var(--accent)] hover:underline">
            Upload one
          </a>{" "}
          to get started.
        </p>
      </div>
    </div>
  );
}
