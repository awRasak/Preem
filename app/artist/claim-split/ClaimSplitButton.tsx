"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";

export function ClaimSplitButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClaim() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/splits/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not claim -- try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm font-bold text-[#34d399]">
        Claimed -- your share is linked to your artist account and held
        revenue starts paying out to you.
      </p>
    );
  }

  return (
    <>
      {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
      <Button onClick={handleClaim} disabled={loading}>
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="xs" tone="current" /> Claiming…
          </span>
        ) : (
          "Claim my share"
        )}
      </Button>
    </>
  );
}
