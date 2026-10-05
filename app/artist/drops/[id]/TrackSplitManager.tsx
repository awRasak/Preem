"use client";

import { useEffect, useState } from "react";
import { SplitSheetEditor, buildSheetPayload, type SheetArtist, type SheetInvite } from "@/components/SplitSheetEditor";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";

// Per-track sheet manager for the drop page: loads the saved sheet (or
// empty = 100% owner), edits, saves. Owner row stored on the sheet is
// folded back into the auto-remainder on load so the editor never shows a
// stale owner share after claim-side drift.
export function TrackSplitManager({
  trackId,
  trackTitle,
  owner,
}: {
  trackId: string;
  trackTitle: string;
  owner: { id: string; stageName: string };
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [splits, setSplits] = useState<SheetArtist[]>([]);
  const [invites, setInvites] = useState<SheetInvite[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/artist/tracks/${trackId}/splits`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const rows = (body.splits ?? []) as { artist_id: string; share_bps: number; artist?: { stage_name: string; avatar_url: string | null } | null }[];
        // Owner row folds into the remainder -- everyone else loads as-is.
        setSplits(
          rows
            .filter((s) => s.artist_id !== owner.id)
            .map((s) => ({
              artistId: s.artist_id,
              stageName: s.artist?.stage_name ?? "Artist",
              avatarUrl: s.artist?.avatar_url ?? null,
              shareBps: s.share_bps,
            })),
        );
        setInvites(
          ((body.invites ?? []) as { name: string; email: string; share_bps: number }[]).map((i) => ({
            name: i.name,
            email: i.email,
            shareBps: i.share_bps,
          })),
        );
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, owner.id]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    const payload = buildSheetPayload(owner.id, splits, invites);
    if (!payload) {
      setError("Shares must be set and add up to 100% (or leave the sheet empty for 100% you).");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/artist/tracks/${trackId}/splits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(body?.error ?? "Could not save the split sheet.");
      return;
    }
    setSaved(true);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-line p-4">
        <p className="inline-flex items-center gap-2 text-xs text-muted">
          <Spinner size="xs" /> Loading split sheet…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{trackTitle}</span>
          <span className="block text-xs text-muted">
            {splits.length + invites.length === 0
              ? "100% you"
              : `${splits.length + invites.length} contributor${splits.length + invites.length === 1 ? "" : "s"}`}
          </span>
        </span>
        <span className="flex-shrink-0 text-xs font-bold text-muted">{open ? "Hide" : "Split"}</span>
      </button>
      {open && (
        <div className="mt-3">
          <SplitSheetEditor
            owner={owner}
            splits={splits}
            invites={invites}
            onChange={(s, i) => {
              setSplits(s);
              setInvites(i);
              setSaved(false);
            }}
          />
          {error && <p className="mt-3 text-sm text-[#ff6b6b]">{error}</p>}
          {saved && <p className="mt-3 text-sm text-[#34d399]">Saved -- future payouts use this sheet.</p>}
          <Button onClick={handleSave} disabled={saving} className="mt-3">
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="xs" tone="current" /> Saving…
              </span>
            ) : (
              "Save split sheet"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
