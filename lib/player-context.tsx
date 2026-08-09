"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { PREVIEW_SECONDS } from "@/lib/preview";

export type PlayerTrack = {
  trackId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  // Presence means: fetch from the public preview endpoint (unauthenticated,
  // capped to PREVIEW_SECONDS) instead of the purchase/owner-gated stream
  // endpoint. `trackId` here narrows to a specific track within the drop —
  // omitted, the server picks the drop's first track.
  preview?: { dropId: string; trackId?: string };
};

type PlayerContextValue = {
  track: PlayerTrack | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  error: boolean;
  play: (track: PlayerTrack) => void;
  toggle: () => void;
  seek: (time: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  // The mount-once effect below registers its listeners a single time, so it
  // reads the latest track through this ref rather than closing over stale state.
  const trackRef = useRef<PlayerTrack | null>(null);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (trackRef.current?.preview && audio.currentTime >= PREVIEW_SECONDS) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
    const onDuration = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onError = () => {
      setError(true);
      setLoading(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
    };
  }, []);

  const play = useCallback(
    async (nextTrack: PlayerTrack) => {
      const audio = audioRef.current;
      if (!audio) return;
      setError(false);

      if (track?.trackId === nextTrack.trackId && audio.src) {
        await audio.play();
        return;
      }

      setLoading(true);
      setTrack(nextTrack);
      try {
        const url = nextTrack.preview
          ? `/api/preview/${nextTrack.preview.dropId}${
              nextTrack.preview.trackId ? `?track=${nextTrack.preview.trackId}` : ""
            }`
          : `/api/stream/${nextTrack.trackId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("stream failed");
        const { url: signedUrl } = await res.json();
        audio.src = signedUrl;
        await audio.play();
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [track],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [track]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = trackRef.current?.preview ? Math.min(time, PREVIEW_SECONDS) : time;
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  return (
    <PlayerContext.Provider
      value={{ track, playing, loading, currentTime, duration, error, play, toggle, seek }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
