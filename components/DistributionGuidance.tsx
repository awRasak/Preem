"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";

export function DistributionGuidance({ dropId }: { dropId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDistributeNow() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/artist/drops/${dropId}/distribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(body?.error ?? "Could not start distribution.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleKeepExclusive() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/artist/drops/${dropId}/keep-exclusive`, {
      method: "POST",
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not update.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold">Your window has closed</h3>
          <Button
            variant="outline"
            onClick={handleKeepExclusive}
            disabled={loading}
            className="!flex-shrink-0 !px-3 !py-1.5 text-xs"
          >
            {loading ? "…" : "Keep exclusive"}
          </Button>
        </div>

        <p className="mb-4 text-xs text-muted">
          Your early-access window has closed. Push it to Spotify, Apple
          Music, Boomplay and more right from here, keep it exclusive to
          Preem, or distribute it yourself elsewhere — either way, buyers who
          already have it keep it.
        </p>

        {error && <p className="mb-3 text-xs text-[#ff6b6b]">{error}</p>}

        <div className="mb-4">
          <Button onClick={handleDistributeNow} disabled={loading}>
            {loading ? "…" : "Distribute to streaming now"}
          </Button>
        </div>

        <Link
          href="/artist/distribute"
          target="_blank"
          className="text-xs font-bold text-muted underline"
        >
          Or distribute it yourself →
        </Link>

        <div className="mt-5">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="!px-4 !py-2 text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
