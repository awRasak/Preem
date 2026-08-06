"use client";

import Image from "next/image";
import { usePlayer } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerBar() {
  const { track, playing, loading, currentTime, duration, error, toggle, seek } =
    usePlayer();

  if (!track) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-8">
        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
          <Image
            src={track.artworkUrl || artworkFallback(track.dropId)}
            alt={track.title}
            fill
            className="object-cover"
            sizes="44px"
          />
        </div>

        <div className="min-w-0 flex-shrink-0 sm:w-40">
          <div className="truncate text-sm font-medium">{track.title}</div>
          <div className="truncate text-xs text-muted">{track.artistName}</div>
        </div>

        <button
          onClick={toggle}
          disabled={loading}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-xs disabled:opacity-50"
        >
          {loading ? "…" : playing ? "❚❚" : "▶"}
        </button>

        <span className="hidden font-mono text-[11px] text-muted sm:inline">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line-strong accent-accent"
        />

        <span className="hidden font-mono text-[11px] text-muted sm:inline">
          {formatTime(duration)}
        </span>

        {error && (
          <span className="text-xs text-[#ff6b6b]">Playback failed</span>
        )}
      </div>
    </div>
  );
}
