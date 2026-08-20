"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePlayer, type PlayerTrack } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";
import { PauseIcon, PlayIcon } from "@/components/Icons";
import { ShareDropButton } from "@/app/artist/drops/[id]/ShareDropButton";

export function TrackDetailModal({
  trackId,
  dropId,
  title,
  artistName,
  artistId,
  artworkUrl,
  lyrics,
  purchaseNote,
  queue,
  onClose,
}: {
  trackId: string;
  dropId: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  lyrics?: string | null;
  purchaseNote?: string;
  queue?: PlayerTrack[];
  onClose: () => void;
}) {
  const { track, playing, loading, play, toggle } = usePlayer();
  const isCurrent = track?.trackId === trackId;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handlePlayToggle() {
    if (isCurrent) {
      toggle();
    } else {
      play({ trackId, title, artistName, artistId, artworkUrl }, queue);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (!cardRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
            <Image src={artworkUrl || artworkFallback(trackId)} alt={title} fill className="object-cover" />
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-muted hover:text-paper"
          >
            ✕
          </button>
        </div>

        <h2 className="mb-1 text-lg font-bold leading-tight">{title}</h2>
        <Link
          href={`/artist/${artistId}`}
          className="text-sm text-muted hover:text-paper hover:underline"
        >
          {artistName}
        </Link>
        {purchaseNote && <p className="mt-1 text-[11px] text-muted">{purchaseNote}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handlePlayToggle}
            disabled={isCurrent && loading}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-sm disabled:opacity-50"
          >
            {isCurrent && loading ? (
              <span className="text-xs">…</span>
            ) : isCurrent && playing ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </button>
          <ShareDropButton dropId={dropId} title={title} />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted">Lyrics</p>
          {lyrics ? (
            <p className="max-h-64 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-paper/90">
              {lyrics}
            </p>
          ) : (
            <p className="text-sm text-muted">No lyrics added for this track yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
