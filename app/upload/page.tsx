import UploadForm from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div>
      <h1 className="text-[1.75rem] font-semibold text-[var(--text-primary)] mb-2">
        Upload Bracket
      </h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Upload a filled-in bracket PDF and Claude will extract your picks.
      </p>

      <UploadForm />
    </div>
  );
}
