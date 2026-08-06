"use client";

import { useRef, useState } from "react";
import Image from "next/image";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function togglePlay() {
    setError(false);

    if (audioRef.current && src) {
      if (playing) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/stream/${dropId}`);
    setLoading(false);

    if (!res.ok) {
      setError(true);
      return;
    }
    const { url } = await res.json();
    setSrc(url);
  }

  return (
    <div className="flex items-center gap-3.5 border-b border-line py-3 last:border-none">
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
        {artworkUrl && (
          <Image src={artworkUrl} alt={title} fill className="object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted">{artistName}</div>
      </div>
      <button
        onClick={togglePlay}
        disabled={loading}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-paper text-xs disabled:opacity-50"
      >
        {loading ? "…" : playing ? "❚❚" : "▶"}
      </button>
      {error && <span className="text-xs text-[#ff6b6b]">Failed</span>}
      {src && (
        <audio
          ref={audioRef}
          src={src}
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
