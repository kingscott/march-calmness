export default function UploadPage() {
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
        Upload Bracket
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Upload a filled-in bracket PDF and Claude will extract your picks.
      </p>

      <div
        className="card"
        style={{
          maxWidth: "560px",
          textAlign: "center",
          padding: "3rem",
          border: "2px dashed var(--border)",
          background: "transparent",
        }}
      >
        <p style={{ color: "var(--text-secondary)" }}>
          Upload form coming soon.
        </p>
      </div>
    </div>
  );
}
