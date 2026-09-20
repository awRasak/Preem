"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/Button";

type PayoutRow = {
  amount_kobo: number;
  status: string;
  created_at: string;
};

// Single-pot withdrawals: everything owed (both gateways, Paystack revenue
// settles into Monipay off-band) pays out through one Monipay transfer when
// the balance clears the ₦10,000 floor.
export function WithdrawCard({
  availableKobo,
  minimumKobo,
  hasBankDetails,
  payouts,
}: {
  availableKobo: number;
  minimumKobo: number;
  hasBankDetails: boolean;
  payouts: PayoutRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [doneKobo, setDoneKobo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meetsMinimum = availableKobo >= minimumKobo;
  const progress = Math.min(availableKobo / minimumKobo, 1);

  async function withdraw() {
    setBusy(true);
    setError(null);
    setDoneKobo(null);
    try {
      const res = await fetch("/api/artist/withdraw", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Withdrawal failed — try again.");
        return;
      }
      setDoneKobo(body.amountKobo as number);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-line bg-surface p-4">
      <div className="mb-1 flex items-end justify-between gap-4">
        <h2 className="text-lg font-bold">Payouts</h2>
        <p className="font-mono text-sm font-bold text-accent">
          {formatNaira(availableKobo)} available
        </p>
      </div>

      {!hasBankDetails ? (
        <p className="mt-2 text-sm text-muted">
          <Link href="/artist/profile?tab=payout" className="text-paper underline">
            Add your payout bank details
          </Link>{" "}
          to withdraw.
        </p>
      ) : doneKobo !== null ? (
        <p className="mt-2 text-sm font-bold text-[#34d399]">
          {formatNaira(doneKobo)} is on its way to your account.
        </p>
      ) : meetsMinimum ? (
        <div className="mt-3">
          <Button onClick={withdraw} variant="primary" disabled={busy}>
            {busy ? "Sending…" : `Withdraw ${formatNaira(availableKobo)}`}
          </Button>
          {error && <p className="mt-2 text-sm text-[#ff6b6b]">{error}</p>}
          <p className="mt-2 text-[11px] text-muted">
            One transfer straight to your bank. Diaspora sales settle in first,
            so the available balance can lag new sales by a day.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <Button variant="primary" disabled title="Unlocks at ₦10,000">
            Withdraw {formatNaira(availableKobo)}
          </Button>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.max(progress * 100, 2)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            {formatNaira(availableKobo)} of {formatNaira(minimumKobo)} minimum
            — keep selling.
          </p>
          {error && <p className="mt-2 text-sm text-[#ff6b6b]">{error}</p>}
        </div>
      )}

      {payouts.length > 0 && (
        <div className="mt-4 divide-y divide-line border-t border-line">
          {payouts.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-xs text-muted">
                {new Date(p.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="text-xs text-muted">{p.status}</span>
              <span className="text-sm font-bold">{formatNaira(p.amount_kobo)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
