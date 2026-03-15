export default function BracketPage() {
  return (
    <div>
      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "0.5rem",
        }}
      >
        Bracket
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Live bracket visualization coming soon.
      </p>

      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          No bracket loaded. <a href="/upload" style={{ color: "var(--accent)" }}>Upload one</a> to get started.
        </p>
      </div>
    </div>
  );
}
