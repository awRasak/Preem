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
  artistId: string;
  artworkUrl: string | null;
  // Presence means: fetch from the public preview endpoint (unauthenticated,
  // capped to PREVIEW_SECONDS) instead of the purchase/owner-gated stream
  // endpoint. `trackId` here narrows to a specific track within the drop —
  // omitted, the server picks the drop's first track.
  preview?: { dropId: string; trackId?: string };
};

export type RepeatMode = "off" | "all" | "one";

type PlayerContextValue = {
  track: PlayerTrack | null;
  queue: PlayerTrack[];
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  error: boolean;
  // `queue` sets the ordered list next()/previous() and end-of-track
  // auto-advance step through. Omit it to play a single track with no
  // neighbors (the default for one-off previews).
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  toggle: () => void;
  seek: (time: number) => void;
  next: () => void;
  previous: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  repeatMode: RepeatMode;
  cycleRepeat: () => void;
  shuffle: boolean;
  toggleShuffle: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);

  // The mount-once effect below registers its listeners a single time, so it
  // reads the latest track/queue through these refs rather than closing over
  // stale state.
  const trackRef = useRef<PlayerTrack | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const repeatModeRef = useRef<RepeatMode>("off");
  const shuffleRef = useRef(false);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  // Guards against a slower, superseded fetch (e.g. rapid next-clicking)
  // overwriting the audio src after a newer one already resolved.
  const loadEpochRef = useRef(0);

  const loadAndPlay = useCallback(async (nextTrack: PlayerTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    const epoch = ++loadEpochRef.current;
    setError(false);
    setLoading(true);
    setTrack(nextTrack);
    try {
      if (nextTrack.preview) {
        // The preview route streams (byte-capped) audio directly, so the
        // element can point straight at it — no signed URL to resolve first.
        const url = `/api/preview/${nextTrack.preview.dropId}${
          nextTrack.preview.trackId ? `?track=${nextTrack.preview.trackId}` : ""
        }`;
        audio.src = url;
        await audio.play();
      } else {
        const res = await fetch(`/api/stream/${nextTrack.trackId}`);
        if (!res.ok) throw new Error("stream failed");
        const { url: signedUrl } = await res.json();
        if (loadEpochRef.current !== epoch) return;
        audio.src = signedUrl;
        await audio.play();
      }
    } catch {
      if (loadEpochRef.current === epoch) setError(true);
    } finally {
      if (loadEpochRef.current === epoch) setLoading(false);
    }
  }, []);

  // Moves within the active queue by `direction`; returns whether it moved —
  // false at either end (unless repeat-all wraps around), or with no active
  // queue. Shuffle only affects forward steps — Previous always walks back
  // through actual queue order, which is the more predictable behavior.
  const step = useCallback(
    (direction: 1 | -1) => {
      const q = queueRef.current;
      const current = trackRef.current;
      if (!current || q.length === 0) return false;
      const idx = q.findIndex((t) => t.trackId === current.trackId);
      if (idx === -1) return false;

      if (direction === 1 && shuffleRef.current && q.length > 1) {
        let nextIdx = idx;
        while (nextIdx === idx) nextIdx = Math.floor(Math.random() * q.length);
        loadAndPlay(q[nextIdx]);
        return true;
      }

      let nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= q.length) {
        if (repeatModeRef.current === "all" && q.length > 0) {
          nextIdx = direction === 1 ? 0 : q.length - 1;
        } else {
          return false;
        }
      }
      loadAndPlay(q[nextIdx]);
      return true;
    },
    [loadAndPlay],
  );

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (trackRef.current?.preview && audio.currentTime >= PREVIEW_SECONDS) {
        audio.pause();
        audio.currentTime = 0;
        step(1);
      }
    };
    const onDuration = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        audio.play();
        return;
      }
      step(1);
    };
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
  }, [step]);

  const play = useCallback(
    (nextTrack: PlayerTrack, nextQueue?: PlayerTrack[]) => {
      setQueue(nextQueue ?? [nextTrack]);
      const audio = audioRef.current;
      if (track?.trackId === nextTrack.trackId && audio?.src) {
        audio.play();
        return;
      }
      loadAndPlay(nextTrack);
    },
    [track, loadAndPlay],
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

  const next = useCallback(() => {
    step(1);
  }, [step]);

  const previous = useCallback(() => {
    step(-1);
  }, [step]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((v) => !v);
  }, []);

  const currentIndex = queue.findIndex((t) => t.trackId === track?.trackId);
  const canWrap = repeatMode === "all" && queue.length > 1;
  const hasNext =
    currentIndex !== -1 && (currentIndex < queue.length - 1 || canWrap || (shuffle && queue.length > 1));
  const hasPrevious = currentIndex > 0 || canWrap;

  return (
    <PlayerContext.Provider
      value={{
        track,
        queue,
        playing,
        loading,
        currentTime,
        duration,
        error,
        play,
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
      }}
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
