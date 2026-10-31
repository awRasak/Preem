"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { formatNaira } from "@/lib/format";
import { launchPayment } from "@/lib/payment-popup";
import type { DistributionEligibility } from "@/lib/distribution/unlock";

type Job = {
  id: string;
  status: string;
  external_id: string | null;
  street_date: string | null;
  upc: string | null;
  rejection_reason: string | null;
  last_error: string | null;
  submitted_at: string | null;
  live_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  not_submitted: "Not set up",
  scheduled: "Scheduled",
  submitted: "In review",
  live: "Live on streaming",
  rejected: "Needs fixes",
  failed: "Failed",
};

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 48; // ~2 minutes for the gateway webhook to land

// Per-drop distribution: push to streaming via the provider with the DSP
// street date. Gated by the earn-it-or-pay-it unlock: locked drops show a
// sales progress meter plus a one-time fee button; the gateway webhook marks
// the unlock paid and this panel polls until it lands, then auto-submits.
export function DistributionPanel({
  dropId,
  dropTitle,
  windowEnd,
  isExclusive,
  initialEligibility,
  initialJob,
}: {
  dropId: string;
  dropTitle: string;
  windowEnd: string | null;
  isExclusive: boolean;
  initialEligibility: DistributionEligibility;
  initialJob: Job | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(initialJob);
  const [eligibility, setEligibility] = useState<DistributionEligibility>(initialEligibility);
  const [streetDate, setStreetDate] = useState(
    initialJob?.street_date ?? (windowEnd ? windowEnd.slice(0, 10) : new Date().toISOString().slice(0, 10)),
  );
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const actionable =
    !job || job.status === "not_submitted" || job.status === "failed" || job.status === "rejected";
  const locked = actionable && !eligibility.unlocked;

  async function handleDistribute() {
    setError(null);
    setWarning(null);
    setLoading(true);
    const res = await fetch(`/api/artist/drops/${dropId}/distribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streetDate }),
    });
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      // Race safety: if the gate still reports locked (stale client state),
      // swap the UI back to the meter instead of a bare error.
      if (body?.code === "locked" && body?.locked) setEligibility(body.locked);
      setError(body?.error ?? "Could not start distribution.");
      return;
    }
    if (body?.warning) setWarning(body.warning);
    if (body?.job) setJob(body.job);
    router.refresh();
  }

  // The gateway webhook is what flips the unlock row to 'paid' -- poll our
  // own status endpoint (not the other session's verify routes) until it
  // lands, then fire the submission the artist just paid for.
  async function waitForUnlock(): Promise<boolean> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const res = await fetch(`/api/artist/drops/${dropId}/distribution-status`).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      if (body?.eligibility?.unlocked) {
        setEligibility(body.eligibility);
        return true;
      }
    }
    return false;
  }

  async function handleUnlock() {
    setError(null);
    setWarning(null);
    setPaying(true);
    const res = await fetch(`/api/artist/drops/${dropId}/distribution-unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body) {
      setError(body?.error ?? "Could not start checkout.");
      setPaying(false);
      return;
    }

    await launchPayment(
      {
        gateway: body.gateway,
        reference: body.reference,
        amountKobo: body.amountKobo,
        publicKey: body.publicKey,
        email: body.email,
      },
      {
        onSuccess: async () => {
          setPaying(false);
          setConfirming(true);
          const unlocked = await waitForUnlock();
          setConfirming(false);
          if (!unlocked) {
            setError(
              "Payment received — confirmation is taking longer than usual. It unlocks automatically; refresh this page in a minute.",
            );
            return;
          }
          // Eligibility state is now current (set inside waitForUnlock) --
          // submit the release the artist just paid for.
          await handleDistribute();
        },
        onCancel: () => setPaying(false),
        onError: (message) => {
          setError(message);
          setPaying(false);
        },
      },
    );
    // Popup still open counts as in-flight (guard belongs to its callbacks).
  }

  const progressPct =
    eligibility.thresholdKobo > 0
      ? Math.min(100, Math.round((eligibility.salesKobo / eligibility.thresholdKobo) * 100))
      : 0;

  return (
    <div className="mb-8 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Streaming distribution</h2>
        <span className="text-xs font-bold text-muted">
          {locked ? "Locked" : (STATUS_LABEL[job?.status ?? "not_submitted"] ?? job?.status)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {job?.status === "live"
          ? `Live on streaming${job.upc ? ` · UPC ${job.upc}` : ""}.`
          : job?.status === "submitted" || job?.status === "scheduled"
            ? `Submitted${job.street_date ? ` · street date ${job.street_date}` : ""} -- status updates automatically.`
            : `Push "${dropTitle}" to Spotify, Apple Music, Boomplay and more. Street date defaults to your window end.`}
      </p>

      {job?.status === "rejected" && job.rejection_reason && (
        <p className="mt-2 text-xs text-[#ff6b6b]">Provider notes: {job.rejection_reason}</p>
      )}
      {job?.status === "failed" && job.last_error && (
        <p className="mt-2 text-xs text-[#ff6b6b]">{job.last_error}</p>
      )}
      {error && <p className="mt-2 text-xs text-[#ff6b6b]">{error}</p>}
      {warning && <p className="mt-2 text-xs text-[#ffd166]">{warning}</p>}

      {locked && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3.5">
          <p className="text-xs text-muted">
            Distribution is covered by your drop&apos;s sales — or unlock it now
            with a one-time fee.{" "}
            <span className="text-paper/90">
              Sell {formatNaira(eligibility.thresholdKobo)} for a free unlock.
            </span>
          </p>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.max(progressPct, 2)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-muted">
              {formatNaira(eligibility.salesKobo)} in sales
            </span>
            <span className="text-muted">{formatNaira(eligibility.thresholdKobo)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={handleUnlock} disabled={paying || confirming}>
              {confirming ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="xs" tone="current" /> Confirming payment…
                </span>
              ) : paying ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="xs" tone="current" /> Waiting for payment…
                </span>
              ) : (
                `Unlock now — ${formatNaira(eligibility.priceKobo)}`
              )}
            </Button>
            <span className="text-[11px] text-muted">
              One-time fee for {eligibility.trackCount} track
              {eligibility.trackCount > 1 ? "s" : ""}.
            </span>
          </div>
        </div>
      )}

      {actionable && !locked && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-muted">
              Street date{isExclusive ? " (required -- exclusives have no window)" : ""}
            </span>
            <input
              type="date"
              value={streetDate}
              onChange={(e) => setStreetDate(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
            />
          </label>
          <Button onClick={handleDistribute} disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="xs" tone="current" /> Submitting…
              </span>
            ) : job
              ? "Retry distribution"
              : "Distribute"
            }
          </Button>
        </div>
      )}
    </div>
  );
}
