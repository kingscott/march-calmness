export default function DashboardPage() {
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
        Dashboard
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Your brackets and live scores will appear here.
      </p>

      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          No brackets yet.{" "}
          <a href="/upload" style={{ color: "var(--accent)" }}>
            Upload a PDF
          </a>{" "}
          to get started.
        </p>
      </div>
    </div>
  );
}
