"use client";

import Image from "next/image";
import { usePlayer } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";

export function PlayerRow({
  dropId,
  title,
  artistName,
  artworkUrl,
}: {
  dropId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
}) {
  const { track, playing, loading, play, toggle } = usePlayer();
  const isCurrent = track?.dropId === dropId;

  function handleClick() {
    if (isCurrent) {
      toggle();
    } else {
      play({ dropId, title, artistName, artworkUrl });
    }
  }

  return (
    <div className="flex items-center gap-3.5 border-b border-line py-3 last:border-none">
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
        <Image
          src={artworkUrl || artworkFallback(dropId)}
          alt={title}
          fill
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted">{artistName}</div>
      </div>
      <button
        onClick={handleClick}
        disabled={isCurrent && loading}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-xs disabled:opacity-50"
      >
        {isCurrent && loading ? "…" : isCurrent && playing ? "❚❚" : "▶"}
      </button>
    </div>
  );
}
