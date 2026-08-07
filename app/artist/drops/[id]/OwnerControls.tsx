"use client";

import { useState } from "react";
import { usePlayer } from "@/lib/player-context";
import { Button } from "@/components/Button";

export function OwnerControls({
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
  const [downloading, setDownloading] = useState(false);
  const isCurrent = track?.dropId === dropId;

  function handlePlay() {
    if (isCurrent) {
      toggle();
    } else {
      play({ dropId, title, artistName, artworkUrl });
    }
  }

  async function handleDownload() {
    setDownloading(true);
    const res = await fetch(`/api/artist/drops/${dropId}/download`);
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
