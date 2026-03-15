"use client";

import { useRef, useState, DragEvent } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import type { Bracket, BracketPicks, Region } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormValues {
  name: string;
  file: FileList;
}

type SubmitPhase =
  | { status: "idle" }
  | { status: "busy"; label: string }
  | { status: "done"; bracket: Bracket }
  | { status: "error"; message: string };

const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>({ status: "idle" });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ mode: "onTouched" });

  // react-hook-form's file input registration — we spread `fileInputRef` manually
  // so we can also use it for the drag-and-drop click trigger.
  const { ref: rhfFileRef, ...fileRegister } = register("file", {
    validate: {
      required: (list) => (list?.length > 0 ? true : "Please select a bracket PDF."),
      isPdf: (list) => {
        const f = list?.[0];
        if (!f) return true; // caught by `required` above
        return (
          f.name.toLowerCase().endsWith(".pdf") ||
          f.type === "application/pdf" ||
          "File must be a PDF."
        );
      },
    },
  });

  const fileList = watch("file");
  const selectedFile = fileList?.[0] ?? null;

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;

    // Synthesise a FileList via DataTransfer so RHF's watch() sees the value
    const dt = new DataTransfer();
    dt.items.add(dropped);
    setValue("file", dt.files, { shouldValidate: true, shouldDirty: true });

    // Auto-fill name from filename if still blank
    const currentName = watch("name");
    if (!currentName) {
      setValue("name", dropped.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " "), {
        shouldValidate: false,
      });
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    const file = values.file[0];

    setSubmitPhase({ status: "busy", label: "Uploading…" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", values.name.trim());

    setSubmitPhase({ status: "busy", label: "Parsing with Claude…" });

    try {
      const res = await fetch("/api/bracket/upload", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as { bracket?: Bracket; error?: string };

      if (!res.ok || !json.bracket) {
        throw new Error(json.error ?? `Server error ${res.status}`);
      }

      setSubmitPhase({ status: "done", bracket: json.bracket });
    } catch (err) {
      setSubmitPhase({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error occurred.",
      });
    }
  }

  function handleReset() {
    reset();
    setSubmitPhase({ status: "idle" });
  }

  // ── Render — success state ──────────────────────────────────────────────────

  if (submitPhase.status === "done") {
    return (
      <SuccessView
        bracket={submitPhase.bracket}
        onAnother={handleReset}
        onDashboard={() => router.push("/")}
      />
    );
  }

  const busy = submitPhase.status === "busy";

  // ── Render — form ───────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6 max-w-[560px]">

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label="Drop PDF here or click to browse"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !busy && openFilePicker()}
        onKeyDown={(e) => e.key === "Enter" && !busy && openFilePicker()}
        className="card text-center py-14 cursor-pointer select-none transition-colors duration-200"
        style={{
          border: `2px dashed ${
            errors.file
              ? "var(--eliminated)"
              : dragging
              ? "var(--accent)"
              : "var(--border)"
          }`,
          background: dragging ? "var(--accent-dim)" : "transparent",
        }}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          disabled={busy}
          {...fileRegister}
          ref={(el) => {
            rhfFileRef(el);
            fileInputRef.current = el;
          }}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <PdfIcon />
            <p className="text-[var(--text-primary)] font-medium">{selectedFile.name}</p>
            <p className="text-[var(--text-secondary)] text-sm">
              {(selectedFile.size / 1024).toFixed(0)} KB · click to replace
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <UploadIcon />
            <p className="text-[var(--text-primary)] font-medium">
              Drop your bracket PDF here
            </p>
            <p className="text-[var(--text-secondary)] text-sm">or click to browse files</p>
          </div>
        )}
      </div>
      {errors.file && (
        <p className="text-sm text-[var(--eliminated)] -mt-4">{errors.file.message}</p>
      )}

      {/* Bracket name */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="bracket-name"
          className="text-sm font-medium text-[var(--text-secondary)]"
        >
          Bracket name
        </label>
        <input
          id="bracket-name"
          type="text"
          placeholder="e.g. Scott's Picks 2026"
          disabled={busy}
          className="rounded-[var(--radius-btn)] border px-4 py-2.5 bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none transition-colors duration-200 disabled:opacity-50"
          style={{
            borderColor: errors.name ? "var(--eliminated)" : "var(--border)",
          }}
          {...register("name", {
            required: "Please enter a name for this bracket.",
            minLength: { value: 2, message: "Name must be at least 2 characters." },
            maxLength: { value: 80, message: "Name must be 80 characters or fewer." },
          })}
        />
        {errors.name && (
          <p className="text-sm text-[var(--eliminated)]">{errors.name.message}</p>
        )}
      </div>

      {/* Server-level error */}
      {submitPhase.status === "error" && (
        <p className="text-sm text-[var(--eliminated)] bg-[color-mix(in_srgb,var(--eliminated)_12%,transparent)] rounded-[var(--radius-btn)] px-4 py-3">
          {submitPhase.message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed min-w-[160px]"
        >
          {busy ? <Spinner label={submitPhase.label} /> : "Parse bracket"}
        </button>

        {!busy && (selectedFile || submitPhase.status === "error") && (
          <button type="button" onClick={handleReset} className="btn btn-ghost">
            Clear
          </button>
        )}
      </div>

      {busy && (
        <p className="text-sm text-[var(--text-secondary)]">
          {submitPhase.label === "Parsing with Claude…"
            ? "Claude is reading your bracket — this takes about 15–30 seconds…"
            : "Uploading PDF…"}
        </p>
      )}
    </form>
  );
}

// ─── Success view ─────────────────────────────────────────────────────────────

function SuccessView({
  bracket,
  onAnother,
  onDashboard,
}: {
  bracket: Bracket;
  onAnother: () => void;
  onDashboard: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 max-w-[560px]">
      <div className="card flex flex-col gap-1" style={{ borderColor: "var(--correct)" }}>
        <p className="text-[var(--correct)] font-semibold text-sm">Bracket parsed successfully</p>
        <p className="text-[var(--text-primary)] font-medium text-lg">{bracket.name}</p>
        <p className="text-[var(--text-secondary)] text-sm">Saved · ID #{bracket.id}</p>
      </div>

      <PicksSummary picks={bracket.picks} />

      <div className="flex gap-3 flex-wrap">
        <button className="btn btn-primary" onClick={onDashboard}>
          Go to dashboard
        </button>
        <button className="btn btn-ghost" onClick={onAnother}>
          Upload another
        </button>
      </div>
    </div>
  );
}

// ─── Picks summary ────────────────────────────────────────────────────────────

function PicksSummary({ picks }: { picks: BracketPicks }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REGIONS.map((region) => {
          const r = picks.regions[region];
          return (
            <div key={region} className="card text-sm flex flex-col gap-2">
              <p className="font-semibold text-[var(--accent)]">{region}</p>
              <Row label="R64 winners" value={r.round1.join(", ")} />
              <Row label="R32 winners" value={r.round2.join(", ")} />
              <Row label="Sweet 16" value={r.sweet16.join(", ")} />
              <Row label="Elite 8" value={r.elite8} highlight />
            </div>
          );
        })}
      </div>

      <div className="card text-sm flex flex-col gap-2">
        <p className="font-semibold text-[var(--accent)]">Final Four &amp; Champion</p>
        <Row label="Final Four" value={picks.final4.join(", ")} />
        <Row label="Champion" value={picks.champion} highlight />
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--text-secondary)] shrink-0 w-24">{label}</span>
      <span className={highlight ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]"}>
        {value}
      </span>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </span>
  );
}

function UploadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
