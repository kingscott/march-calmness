"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  bracketId: number;
  bracketName: string;
}

export default function DeleteButton({ bracketId, bracketName }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await fetch(`/api/bracket/${bracketId}`, { method: "DELETE" });
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-sm text-[var(--text-secondary)] hidden sm:inline">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="btn text-sm py-1.5 px-3 disabled:opacity-50"
          style={{ background: "var(--eliminated)", color: "#fff" }}
        >
          {isPending ? "Deleting…" : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="btn btn-ghost text-sm py-1.5 px-3"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      aria-label={`Delete bracket "${bracketName}"`}
      className="btn btn-ghost text-sm py-1.5 px-3 text-[var(--eliminated)] hover:text-[var(--eliminated)]"
      style={{ borderColor: "transparent" }}
    >
      Delete
    </button>
  );
}
