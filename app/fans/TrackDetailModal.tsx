"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePlayer, type PlayerTrack } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";
import { activeLrcLine, parseLrc } from "@/lib/lrc";
import { DownloadIcon, PauseIcon, PlayIcon } from "@/components/Icons";
import { Spinner } from "@/components/Loader";
import { ShareDropButton } from "@/app/artist/drops/[id]/ShareDropButton";

export function TrackDetailModal({
  trackId,
  dropId,
  title,
  artistName,
  artistId,
  artworkUrl,
  lyrics,
  lyricsLrc,
  sharePath,
  purchaseNote,
  queue,
  onClose,
}: {
  trackId: string;
  dropId: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  lyrics?: string | null;
  lyricsLrc?: string | null;
  sharePath?: string;
  purchaseNote?: string;
  queue?: PlayerTrack[];
  onClose: () => void;
}) {
  const { track, playing, loading, error, currentTime, seek, play, toggle } = usePlayer();
  // Full-track modal -- a playing preview of the same id is not "current".
  const isCurrent = track?.trackId === trackId && !track?.preview;
  const isFailed = isCurrent && error;
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const lrcLines = useMemo(() => (lyricsLrc ? parseLrc(lyricsLrc) : []), [lyricsLrc]);
  // currentTime only describes this track while it's the one actually
  // loaded/playing; otherwise nothing should be highlighted as active.
  const activeIndex = isCurrent && lrcLines.length > 0 ? activeLrcLine(lrcLines, currentTime) : -1;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handlePlayToggle() {
    // A failed load leaves a dead src on the audio element -- retrying via
    // toggle() would just resume silence, so re-run the full load instead.
    if (isCurrent && !error) {
      toggle();
    } else {
      play({ trackId, title, artistName, artistId, artworkUrl, lyrics, lyricsLrc }, queue);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/fans/tracks/${trackId}/download`);
      if (!res.ok) return;
      const { url } = await res.json();
      // Fetch the file into memory and save it via an in-page anchor rather
      // than navigating to the signed URL -- navigating away often just
      // opens/plays the file inline (especially on mobile) instead of
      // saving it, and takes the fan out of the app.
      const audioRes = await fetch(url);
      const blob = await audioRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      const ext = url.split("?")[0].split(".").pop() || "mp3";
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${title}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (!cardRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
            <Image src={artworkUrl || artworkFallback(trackId)} alt={title} fill className="object-cover" />
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-muted hover:text-paper"
          >
            ✕
          </button>
        </div>

        <h2 className="mb-1 text-lg font-bold leading-tight">{title}</h2>
        <Link
          href={`/artist/${artistId}`}
          className="text-sm text-muted hover:text-paper hover:underline"
        >
          {artistName}
        </Link>
        {purchaseNote && <p className="mt-1 text-[11px] text-muted">{purchaseNote}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handlePlayToggle}
            disabled={isCurrent && loading}
            aria-label={isFailed ? "Playback failed — tap to retry" : undefined}
            title={isFailed ? "Playback failed — tap to retry" : undefined}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-sm disabled:opacity-50"
          >
            {isFailed ? (
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff6b6b] text-[9px] font-bold text-[#1a0d05]"
                aria-hidden="true"
              >
                !
              </span>
            ) : isCurrent && loading ? (
              <Spinner size="xs" />
            ) : isCurrent && playing ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </button>
          <ShareDropButton dropId={dropId} path={sharePath} title={title} />
          <button
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Download"
            title="Download"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-sm disabled:opacity-50"
          >
            {downloading ? <Spinner size="xs" /> : <DownloadIcon className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted">Lyrics</p>
          {lrcLines.length > 0 ? (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {lrcLines.map((line, i) =>
                line.text ? (
                  <button
                    key={`${line.time}-${i}`}
                    onClick={() => isCurrent && seek(line.time)}
                    disabled={!isCurrent}
                    className={`block w-full text-left text-sm leading-relaxed transition-colors ${
                      i === activeIndex
                        ? "font-bold text-paper"
                        : isCurrent
                          ? "text-paper/60 hover:text-paper/90"
                          : "text-paper/90"
                    }`}
                  >
                    {line.text}
                  </button>
                ) : null,
              )}
            </div>
          ) : lyrics ? (
            <p className="max-h-64 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-paper/90">
              {lyrics}
            </p>
          ) : (
            <p className="text-sm text-muted">No lyrics added for this track yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
