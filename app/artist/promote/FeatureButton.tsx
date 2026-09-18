"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Pins (or unpins) a published drop as the artist's featured "current
// single" -- the hero on the public artist page. One pin at a time.
export function FeatureButton({
  dropId,
  isFeatured,
}: {
  dropId: string;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/artist/featured-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_id: isFeatured ? null : dropId }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={isFeatured}
        className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
          isFeatured
            ? "border-accent text-accent"
            : "border-line-strong hover:bg-surface-2"
        }`}
      >
        {busy ? "…" : isFeatured ? "★ Featured" : "☆ Feature"}
      </button>
      {error && (
        <p className="text-[11px] text-[#ff6b6b]">Couldn&apos;t save.</p>
      )}
    </div>
  );
}
