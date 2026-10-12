"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";

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

// Per-drop distribution: push to streaming via the provider with the DSP
// street date. Pre-submit during the countdown (street date = window end);
// the cron + provider webhooks carry the status to live afterwards.
export function DistributionPanel({
  dropId,
  dropTitle,
  windowEnd,
  isExclusive,
  initialJob,
}: {
  dropId: string;
  dropTitle: string;
  windowEnd: string | null;
  isExclusive: boolean;
  initialJob: Job | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(initialJob);
  const [streetDate, setStreetDate] = useState(
    initialJob?.street_date ?? (windowEnd ? windowEnd.slice(0, 10) : new Date().toISOString().slice(0, 10)),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const actionable =
    !job || job.status === "not_submitted" || job.status === "failed" || job.status === "rejected";

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
      setError(body?.error ?? "Could not start distribution.");
      return;
    }
    if (body?.warning) setWarning(body.warning);
    if (body?.job) setJob(body.job);
    router.refresh();
  }

  return (
    <div className="mb-8 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Streaming distribution</h2>
        <span className="text-xs font-bold text-muted">
          {STATUS_LABEL[job?.status ?? "not_submitted"] ?? job?.status}
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

      {actionable && (
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
