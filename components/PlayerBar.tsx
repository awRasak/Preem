"use client";

import Image from "next/image";
import Link from "next/link";
import { usePlayer } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";
import { PREVIEW_SECONDS } from "@/lib/preview";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerBar() {
  const {
    track,
    playing,
    loading,
    currentTime,
    duration,
    error,
    toggle,
    seek,
    next,
    previous,
    hasNext,
    hasPrevious,
    repeatMode,
    cycleRepeat,
    shuffle,
    toggleShuffle,
  } = usePlayer();

  if (!track) return null;

  const displayDuration = track.preview ? Math.min(duration || PREVIEW_SECONDS, PREVIEW_SECONDS) : duration;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-8">
        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
          <Image
            src={track.artworkUrl || artworkFallback(track.trackId)}
            alt={track.title}
            fill
            className="object-cover"
            sizes="44px"
          />
        </div>

        <div className="min-w-0 flex-shrink-0 sm:w-40">
          <div className="truncate text-sm font-medium">{track.title}</div>
          <div className="truncate text-xs text-muted">
            <Link href={`/artist/${track.artistId}`} className="hover:text-paper hover:underline">
              {track.artistName}
            </Link>
            {track.preview && <span className="ml-1.5 text-accent">· Preview</span>}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={toggleShuffle}
            aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
            aria-pressed={shuffle}
            className={`hidden h-8 w-8 items-center justify-center rounded-full text-sm hover:text-paper sm:flex ${
              shuffle ? "text-accent" : "text-muted"
            }`}
          >
            🔀
          </button>
          <button
            onClick={previous}
            disabled={!hasPrevious || loading}
            aria-label="Previous track"
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted hover:text-paper disabled:opacity-30 disabled:hover:text-muted"
          >
            ⏮
          </button>
          <button
            onClick={toggle}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-paper text-xs disabled:opacity-50"
          >
            {loading ? "…" : playing ? "❚❚" : "▶"}
          </button>
          <button
            onClick={next}
            disabled={!hasNext || loading}
            aria-label="Next track"
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted hover:text-paper disabled:opacity-30 disabled:hover:text-muted"
          >
            ⏭
          </button>
          <button
            onClick={cycleRepeat}
            aria-label={`Repeat: ${repeatMode}`}
            aria-pressed={repeatMode !== "off"}
            className={`relative hidden h-8 w-8 items-center justify-center rounded-full text-sm hover:text-paper sm:flex ${
              repeatMode !== "off" ? "text-accent" : "text-muted"
            }`}
          >
            🔁
            {repeatMode === "one" && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-[#1a0d05]">
                1
              </span>
            )}
          </button>
        </div>

        <span className="hidden font-mono text-[11px] text-muted sm:inline">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={displayDuration || 0}
          step={0.1}
          value={Math.min(currentTime, displayDuration || currentTime)}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line-strong accent-accent"
        />

        <span className="hidden font-mono text-[11px] text-muted sm:inline">
          {formatTime(displayDuration)}
        </span>

        {error && (
          <span className="text-xs text-[#ff6b6b]">Playback failed</span>
        )}
      </div>
    </div>
  );
}
