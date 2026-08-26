"use client";

import { usePlayer, type PlayerTrack } from "@/lib/player-context";
import { PauseIcon, PlayIcon } from "@/components/Icons";

export function PreviewButton({
  dropId,
  trackId,
  title,
  artistName,
  artistId,
  artworkUrl,
  queue,
  className = "",
  iconClassName = "h-4 w-4",
}: {
  dropId: string;
  trackId?: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  // Sibling tracks (e.g. the rest of an EP) so Next/Previous on the player
  // bar can step through them. Omit for a standalone preview.
  queue?: PlayerTrack[];
  className?: string;
  iconClassName?: string;
}) {
  const { track, playing, loading, error, play, toggle } = usePlayer();
  const key = trackId ?? dropId;
  const isCurrent = track?.trackId === key;
  const isFailed = isCurrent && error;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // A failed load leaves a dead src on the audio element -- retrying via
    // toggle() would just resume silence, so re-run the full load instead.
    if (isCurrent && !error) {
      toggle();
    } else {
      play(
        {
          trackId: key,
          title,
          artistName,
          artistId,
          artworkUrl,
          preview: { dropId, trackId },
        },
        queue,
      );
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        isFailed
          ? "Playback failed — tap to retry"
          : isCurrent && playing
            ? "Pause preview"
            : "Play 15-second preview"
      }
      title={isFailed ? "Playback failed — tap to retry" : undefined}
      className={className}
    >
      {isFailed ? (
        <span
          className={`flex items-center justify-center rounded-full bg-[#ff6b6b] font-bold text-[#1a0d05] ${iconClassName}`}
          style={{ fontSize: "0.625em" }}
          aria-hidden="true"
        >
          !
        </span>
      ) : isCurrent && loading ? (
        <span className="text-xs">…</span>
      ) : isCurrent && playing ? (
        <PauseIcon className={iconClassName} />
      ) : (
        <PlayIcon className={iconClassName} />
      )}
    </button>
  );
}
