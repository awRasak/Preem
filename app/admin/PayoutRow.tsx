"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { formatNaira } from "@/lib/format";

export function PayoutRow({
  artistId,
  stageName,
  balanceKobo,
  hasBankDetails,
}: {
  artistId: string;
  stageName: string;
  balanceKobo: number;
  hasBankDetails: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Payout failed");
      return;
    }
    router.refresh();
  }

  return (
    <tr className="border-b border-line last:border-none">
      <td className="py-3 pr-4 text-sm">{stageName}</td>
      <td className="py-3 pr-4 font-mono text-sm text-accent">
        {formatNaira(balanceKobo)}
      </td>
      <td className="py-3 text-right">
        {error && <span className="mr-3 text-xs text-[#ff6b6b]">{error}</span>}
        <Button
          variant="primary"
          disabled={loading || balanceKobo <= 0 || !hasBankDetails}
          onClick={trigger}
          className="!px-3 !py-1.5 text-xs"
        >
          {loading
            ? "…"
            : !hasBankDetails
              ? "No bank details"
              : "Trigger payout"}
        </Button>
      </td>
    </tr>
  );
}
