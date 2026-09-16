"use client";

import { usePlayer, type PlayerTrack } from "@/lib/player-context";
import { useCurrentRole } from "@/lib/use-current-role";
import { Spinner } from "@/components/Loader";
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
  const { role } = useCurrentRole();
  // Admins listen to the full track, not the 15-second sample -- the stream
  // route authorizes admins directly, so a plain full PlayerTrack (no
  // `preview` seam) resolves to the complete audio.
  const isAdmin = role === "admin";
  const key = trackId ?? dropId;
  // Preview and full versions share a trackId -- this button owns the
  // preview side only, so a playing full track is NOT "current" here. For
  // admins the roles flip: their taps play full, so the current-mode check
  // must match full tracks instead.
  const isCurrent =
    track?.trackId === key && (isAdmin ? !track?.preview : !!track?.preview);
  const isFailed = isCurrent && error;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // A failed load leaves a dead src on the audio element -- retrying via
    // toggle() would just resume silence, so re-run the full load instead.
    if (isCurrent && !error) {
      toggle();
    } else if (isAdmin) {
      // Full stream of this track (or the drop's first track, when no
      // explicit trackId was given e.g. card buttons). Strip the preview
      // seam out of any passed queue so Next/Previous stays full too.
      play(
        {
          trackId: key,
          title,
          artistName,
          artistId,
          artworkUrl,
        },
        queue?.map((t) => ({ ...t, preview: undefined })),
      );
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
            ? isAdmin
              ? "Pause"
              : "Pause preview"
            : isAdmin
              ? "Play"
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
        <Spinner size="xs" />
      ) : isCurrent && playing ? (
        <PauseIcon className={iconClassName} />
      ) : (
        <PlayIcon className={iconClassName} />
      )}
    </button>
  );
}
