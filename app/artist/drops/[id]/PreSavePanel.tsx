"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { CopyLinkButton } from "@/app/artist/promote/CopyLinkButton";
import { formatReleaseDate } from "@/lib/format";

// Owner-side pre-save controls for a draft: toggle the public page, see the
// link + count, and flip the drop live when the teaser window is over.
export function PreSavePanel({
  dropId,
  presaveEnabled,
  presaveCount,
  releaseDate,
}: {
  dropId: string;
  presaveEnabled: boolean;
  presaveCount: number;
  releaseDate: string | null;
}) {
  const [enabled, setEnabled] = useState(presaveEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/artist/drops/${dropId}/presave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(body?.error ?? "Could not update pre-save.");
      return;
    }
    setEnabled(next);
  }

  return (
    <div className="mb-8 rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Pre-save</h2>
          <p className="mt-0.5 text-xs text-muted">
            {enabled ? (
              <>
                Public — {presaveCount} fan{presaveCount === 1 ? "" : "s"}
                {releaseDate ? ` · drops ${formatReleaseDate(releaseDate)}` : ""}
              </>
            ) : (
              "Off — this drop has no coming-soon page"
            )}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {enabled ? (
            <button
              type="button"
              onClick={() => toggle(false)}
              disabled={saving}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:bg-surface-2"
            >
              {saving ? "Saving…" : "Stop pre-save"}
            </button>
          ) : (
            <Button
              variant="outline"
              onClick={() => toggle(true)}
              disabled={saving}
              className="!px-4 !py-2 text-xs"
            >
              {saving ? "Saving…" : "Start pre-save"}
            </Button>
          )}
        </div>
      </div>

      {enabled && (
        <div className="mb-3">
          <CopyLinkButton path={`/drop/${dropId}`} label="pre-save page" />
        </div>
      )}

      {error && <p className="mb-2 text-sm text-[#ff6b6b]">{error}</p>}

      <div className="border-t border-line pt-4">
        <p className="mb-3 text-xs text-muted">
          Publishing closes the pre-save page and notifies everyone who
          pre-saved that the drop is live.
        </p>
        <div className="flex justify-end">
          <PublishDropButton dropId={dropId} />
        </div>
      </div>
    </div>
  );
}

function PublishDropButton({ dropId }: { dropId: string }) {
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    const res = await fetch(`/api/artist/drops/${dropId}/publish`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setPublishing(false);
    if (!res.ok) {
      setError(body?.error ?? "Could not publish the drop.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return <span className="text-xs font-bold text-accent">Live!</span>;
  }

  return (
    <div className="text-right">
      <Button
        variant="primary"
        onClick={handlePublish}
        disabled={publishing}
        className="!px-5 !py-2 text-xs"
      >
        {publishing ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="xs" tone="current" /> Publishing…
          </span>
        ) : (
          "Publish now"
        )}
      </Button>
      {error && <p className="mt-2 text-xs text-[#ff6b6b]">{error}</p>}
    </div>
  );
}