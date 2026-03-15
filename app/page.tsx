export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-[1.75rem] font-semibold text-[var(--text-primary)] mb-2">
        Dashboard
      </h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Your brackets and live scores will appear here.
      </p>

      <div className="card text-center py-12">
        <p className="text-[var(--text-secondary)]">
          No brackets yet. <a href="/upload" className="text-[var(--accent)] hover:underline">Upload a PDF</a> to get started.
        </p>
      </div>
    </div>
  );
}
