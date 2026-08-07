"use client";

import { useState } from "react";
import Image from "next/image";
import { usePlayer } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";

export function PlayerRow({
  trackId,
  title,
  artistName,
  artworkUrl,
  lyrics,
}: {
  trackId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  lyrics?: string | null;
}) {
  const { track, playing, loading, play, toggle } = usePlayer();
  const isCurrent = track?.trackId === trackId;
  const [showLyrics, setShowLyrics] = useState(false);

  function handleClick() {
    if (isCurrent) {
      toggle();
    } else {
      play({ trackId, title, artistName, artworkUrl });
    }
  }

  return (
    <div className="border-b border-line py-3 last:border-none">
      <div className="flex items-center gap-3.5">
        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
          <Image
            src={artworkUrl || artworkFallback(trackId)}
            alt={title}
            fill
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="mt-0.5 truncate text-xs text-muted">{artistName}</div>
        </div>
        {lyrics && (
          <button
            onClick={() => setShowLyrics((v) => !v)}
            className="flex-shrink-0 text-[11px] font-bold text-muted underline hover:text-paper"
          >
            Lyrics
          </button>
        )}
        <button
          onClick={handleClick}
          disabled={isCurrent && loading}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-xs disabled:opacity-50"
        >
          {isCurrent && loading ? "…" : isCurrent && playing ? "❚❚" : "▶"}
        </button>
      </div>
      {showLyrics && lyrics && (
        <p className="ml-[59px] mt-3 whitespace-pre-line text-sm leading-relaxed text-paper/90">
          {lyrics}
        </p>
      )}
    </div>
  );
}
