"use client";

import { usePlayer } from "@/lib/player-context";

export function PreviewButton({
  dropId,
  trackId,
  title,
  artistName,
  artworkUrl,
  className = "",
}: {
  dropId: string;
  trackId?: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  className?: string;
}) {
  const { track, playing, loading, play, toggle } = usePlayer();
  const key = trackId ?? dropId;
  const isCurrent = track?.trackId === key;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isCurrent) {
      toggle();
    } else {
      play({
        trackId: key,
        title,
        artistName,
        artworkUrl,
        preview: { dropId, trackId },
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isCurrent && playing ? "Pause preview" : "Play 15-second preview"}
      className={className}
    >
      {isCurrent && loading ? "…" : isCurrent && playing ? "❚❚" : "▶"}
    </button>
  );
}
