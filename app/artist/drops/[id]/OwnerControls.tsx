"use client";

import { useState } from "react";
import { usePlayer } from "@/lib/player-context";
import { Button } from "@/components/Button";
import { DownloadIcon, PauseIcon, PlayIcon } from "@/components/Icons";

export function OwnerControls({
  trackId,
  title,
  artistName,
  artistId,
  artworkUrl,
  showDownload = true,
}: {
  trackId: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  showDownload?: boolean;
}) {
  const { track, playing, loading, play, toggle } = usePlayer();
  const [downloading, setDownloading] = useState(false);
  const isCurrent = track?.trackId === trackId;

  function handlePlay() {
    if (isCurrent) {
      toggle();
    } else {
      play({ trackId, title, artistName, artistId, artworkUrl });
    }
  }

  async function handleDownload() {
    setDownloading(true);
    const res = await fetch(`/api/artist/tracks/${trackId}/download`);
    setDownloading(false);
    if (!res.ok) return;
    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handlePlay}
        disabled={isCurrent && loading}
        className="!px-4 !py-2 text-xs"
      >
        {isCurrent && loading ? (
          "Loading…"
        ) : isCurrent && playing ? (
          <>
            <PauseIcon className="h-3.5 w-3.5" /> Pause
          </>
        ) : (
          <>
            <PlayIcon className="h-3.5 w-3.5" /> Preview
          </>
        )}
      </Button>
      {showDownload && (
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={downloading}
          className="!px-4 !py-2 text-xs"
        >
          {downloading ? "…" : (
            <>
              <DownloadIcon className="h-3.5 w-3.5" /> Download
            </>
          )}
        </Button>
      )}
    </>
  );
}
