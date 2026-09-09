"use client";

import { useState } from "react";
import { PauseIcon, PlayIcon } from "@/components/Icons";

// On-demand full-track playback for admin surfaces. The stream URL is
// fetched lazily (the /api/stream route already authorizes admins) so
// listing pages don't mint hundreds of signed URLs up front.
export function TrackPlayButton({
  trackId,
  title,
}: {
  trackId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (url) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/stream/${trackId}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (!body.url) throw new Error();
      setUrl(body.url);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? `Hide player for ${title}` : `Play ${title}`}
        title={failed ? "Couldn't load audio — tap to retry" : undefined}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
          failed
            ? "border-[#ff6b6b] text-[#ff6b6b]"
            : open
              ? "border-accent bg-accent/10 text-accent"
              : "border-line-strong text-muted hover:text-paper"
        }`}
      >
        {loading ? (
          <span className="text-[10px] font-bold">…</span>
        ) : open ? (
          <PauseIcon className="h-3 w-3" />
        ) : (
          <PlayIcon className="h-3 w-3" />
        )}
      </button>
      {open && (
        <span className="mt-1 block min-w-52">
          {failed && !loading ? (
            <span className="text-[11px] text-[#ff6b6b]">Couldn&apos;t load audio.</span>
          ) : url ? (
            <audio controls preload="none" src={url} className="w-full" />
          ) : null}
        </span>
      )}
    </span>
  );
}
