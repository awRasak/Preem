"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

const OUTCOME_BADGE = {
  approved: { status: "live", label: "Approved" },
  rejected: { status: "closed", label: "Rejected" },
  cancelled: { status: "closed", label: "Withdrawn" },
} as const;

export function AudioChangeRequestRow({
  id,
  artistName,
  dropTitle,
  trackTitle,
  reason,
  createdAt,
  previewUrl,
  liveUrl,
  status,
}: {
  id: string;
  artistName: string;
  dropTitle: string;
  trackTitle: string;
  reason: string;
  createdAt: string;
  previewUrl: string | null;
  liveUrl: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approved" | "rejected" | null>(null);

  async function review(status: "approved" | "rejected") {
    setLoading(status);
    await fetch(`/api/admin/track-change-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="border-b border-line py-4 last:border-none">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-bold">
          {artistName} <span className="font-normal text-muted">· {dropTitle}</span>
        </div>
        <div className="text-[11px] text-muted">
          Audio ·{" "}
          {new Date(createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>
      <div className="mb-1.5 text-xs font-bold text-accent">{trackTitle}</div>
      <p className="mb-3 text-sm text-muted">
        <span className="font-bold text-paper">Reason:</span> {reason}
      </p>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            Replacement
          </p>
          {previewUrl ? (
            <audio controls preload="none" src={previewUrl} className="w-full" />
          ) : (
            <p className="text-xs text-muted">Replacement audio unavailable.</p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            Current live version
          </p>
          {liveUrl ? (
            <audio controls preload="none" src={liveUrl} className="w-full" />
          ) : (
            <p className="text-xs text-muted">Live audio unavailable.</p>
          )}
        </div>
      </div>
      {status === "pending" ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={loading !== null}
            onClick={() => review("rejected")}
            className="!px-3 !py-1.5 text-xs"
          >
            {loading === "rejected" ? "…" : "Reject"}
          </Button>
          <Button
            variant="primary"
            disabled={loading !== null}
            onClick={() => review("approved")}
            className="!px-3 !py-1.5 text-xs"
          >
            {loading === "approved" ? "…" : "Approve & swap"}
          </Button>
        </div>
      ) : (
        <Badge status={OUTCOME_BADGE[status].status}>
          {OUTCOME_BADGE[status].label}
        </Badge>
      )}
    </div>
  );
}
