"use client";

import { useState } from "react";
import { usePlayer } from "@/lib/player-context";
import { Button } from "@/components/Button";

export function OwnerControls({
  trackId,
  title,
  artistName,
  artworkUrl,
}: {
  trackId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
}) {
  const { track, playing, loading, play, toggle } = usePlayer();
  const [downloading, setDownloading] = useState(false);
  const isCurrent = track?.trackId === trackId;

  function handlePlay() {
    if (isCurrent) {
      toggle();
    } else {
      play({ trackId, title, artistName, artworkUrl });
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
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handlePlay}
        disabled={isCurrent && loading}
        className="!px-4 !py-2 text-xs"
      >
        {isCurrent && loading
          ? "Loading…"
          : isCurrent && playing
            ? "❚❚ Pause"
            : "▶ Preview"}
      </Button>
      <Button
        variant="outline"
        onClick={handleDownload}
        disabled={downloading}
        className="!px-4 !py-2 text-xs"
      >
        {downloading ? "…" : "Download"}
      </Button>
    </div>
  );
}
