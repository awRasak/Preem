"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePlayer, type PlayerTrack } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";
import { PauseIcon, PlayIcon } from "@/components/Icons";
import { TrackDetailModal } from "./TrackDetailModal";

export function PlayerRow({
  dropId,
  trackId,
  title,
  artistName,
  artistId,
  artworkUrl,
  lyrics,
  purchaseNote,
  queue,
}: {
  dropId: string;
  trackId: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  lyrics?: string | null;
  purchaseNote?: string;
  queue?: PlayerTrack[];
}) {
  const { track, playing, loading, play, toggle } = usePlayer();
  const isCurrent = track?.trackId === trackId;
  const [showModal, setShowModal] = useState(false);

  function handlePlayToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (isCurrent) {
      toggle();
    } else {
      play({ trackId, title, artistName, artistId, artworkUrl }, queue);
    }
  }

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="flex cursor-pointer items-center gap-3.5 border-b border-line py-3 last:border-none"
      >
        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
          <Image src={artworkUrl || artworkFallback(trackId)} alt={title} fill className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="mt-0.5 truncate text-xs text-muted">
            <Link
              href={`/artist/${artistId}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-paper hover:underline"
            >
              {artistName}
            </Link>
            {purchaseNote && ` · ${purchaseNote}`}
          </div>
        </div>
        <button
          onClick={handlePlayToggle}
          disabled={isCurrent && loading}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-xs disabled:opacity-50"
        >
          {isCurrent && loading ? (
            <span className="text-xs">…</span>
          ) : isCurrent && playing ? (
            <PauseIcon className="h-3.5 w-3.5" />
          ) : (
            <PlayIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {showModal && (
        <TrackDetailModal
          trackId={trackId}
          dropId={dropId}
          title={title}
          artistName={artistName}
          artistId={artistId}
          artworkUrl={artworkUrl}
          lyrics={lyrics}
          purchaseNote={purchaseNote}
          queue={queue}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
