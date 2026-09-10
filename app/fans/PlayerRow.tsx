"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePlayer, type PlayerTrack } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";
import { PauseIcon, PlayIcon } from "@/components/Icons";
import { Spinner } from "@/components/Loader";
import { TrackDetailModal } from "./TrackDetailModal";

export function PlayerRow({
  dropId,
  trackId,
  title,
  artistName,
  artistId,
  artworkUrl,
  lyrics,
  lyricsLrc,
  sharePath,
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
  lyricsLrc?: string | null;
  sharePath?: string;
  purchaseNote?: string;
  queue?: PlayerTrack[];
}) {
  const { track, playing, loading, error, play, toggle } = usePlayer();
  // This row plays the owned FULL track -- a playing preview of the same id
  // is not "current" here; tapping must load the full stream, not toggle it.
  const isCurrent = track?.trackId === trackId && !track?.preview;
  const isFailed = isCurrent && error;
  const [showModal, setShowModal] = useState(false);

  function handlePlayToggle(e: React.MouseEvent) {
    e.stopPropagation();
    // A failed load leaves a dead src on the audio element -- retrying via
    // toggle() would just resume silence, so re-run the full load instead.
    if (isCurrent && !error) {
      toggle();
    } else {
      play({ trackId, title, artistName, artistId, artworkUrl, lyrics, lyricsLrc }, queue);
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
          aria-label={isFailed ? "Playback failed — tap to retry" : undefined}
          title={isFailed ? "Playback failed — tap to retry" : undefined}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-xs disabled:opacity-50"
        >
          {isFailed ? (
            <span
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ff6b6b] text-[8px] font-bold text-[#1a0d05]"
              aria-hidden="true"
            >
              !
            </span>
          ) : isCurrent && loading ? (
            <Spinner size="xs" />
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
          lyricsLrc={lyricsLrc}
          sharePath={sharePath}
          purchaseNote={purchaseNote}
          queue={queue}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
