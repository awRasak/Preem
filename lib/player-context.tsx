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
import { artworkFallback } from "@/lib/placeholder";

export type PlayerTrack = {
  trackId: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  // Shown on the player's Lyrics tab. Lyrics are public on drop pages, so
  // carrying them here leaks nothing that isn't already visible.
  lyrics?: string | null;
  // Optional LRC (timestamped) variant -- enables synced highlighting and
  // tap-to-seek on the Lyrics tab.
  lyricsLrc?: string | null;
  // Human label for where this queue came from ("Lagos Nights", the fan's
  // library...) shown as "Playing from …" on the now-playing screen.
  collectionTitle?: string | null;
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
  // `silentAutoplay` swallows gesture-blocked play() rejections
  // (NotAllowedError) without raising the error UI -- for programmatic
  // starts after an async round trip (e.g. post-payment autoplay), where a
  // block means "stay quiet", not "something broke". Real load failures
  // still surface.
  play: (track: PlayerTrack, queue?: PlayerTrack[], opts?: { silentAutoplay?: boolean }) => void;
  toggle: () => void;
  seek: (time: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  next: () => void;
  previous: () => void;
  // Dismisses the player entirely: stops audio and clears track + queue.
  close: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  repeatMode: RepeatMode;
  cycleRepeat: () => void;
  shuffle: boolean;
  toggleShuffle: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

// Signed URLs live 5 minutes -- cache them just short of that.
const URL_FRESH_MS = 4 * 60 * 1000;

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
  // Remembered per-browser (not per-account) -- same treatment as any other
  // local media player's volume setting. Lazy-init reads localStorage only
  // on the client; SSR/hydration always start from the same 1.0 default.
  const [volume, setVolumeState] = useState(() => {
    if (typeof window === "undefined") return 1;
    const raw = window.localStorage.getItem("preem-volume");
    if (raw === null) return 1;
    const stored = Number(raw);
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 1;
  });
  // The mount-once effect below reads this instead of `volume` directly --
  // it constructs the Audio element exactly once, so it must not depend on
  // (and re-run for) every volume change.
  const initialVolumeRef = useRef(volume);

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

  // Signed URLs live 5 minutes, so cache them just short of that -- pressing
  // play on an already-queued track then starts instantly instead of paying
  // auth + DB + sign round trips first. Previews need no resolution (their
  // URL is deterministic) and are deliberately NOT cached: they're tiny.
  const urlCacheRef = useRef(new Map<string, { url: string; at: number }>());

  // Warms bytes for the upcoming track without ever playing: assigned a src
  // + preload=auto the moment the current track can play, so advancing is a
  // cache hit instead of a cold network start.
  //
  // Gapless rotation: the standby element IS the second player. The prefetch
  // effect below keeps it loaded with the deterministic next track; when
  // advancing, loadAndPlay swaps it in instead of re-setting src on the
  // active element, so there is no network/rebuffer gap between tracks.
  // HTMLAudioElement can't do sample-accurate gapless, but a preloaded swap
  // lands in the tens of ms rather than the hundreds.
  const elementsRef = useRef<HTMLAudioElement[]>([]);
  const standbyKeyRef = useRef<string | null>(null);

  function cacheKeyFor(t: PlayerTrack): string {
    return t.preview
      ? `preview:${t.preview.dropId}:${t.preview.trackId ?? ""}`
      : t.trackId;
  }

  // Crossfade window: the last seconds of a track overlap the preloaded
  // standby instead of hard-swapping at `ended`. Tunable in one place.
  const CROSSFADE_SECONDS = 3;
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  const crossfadeRef = useRef<{ on: boolean; next: PlayerTrack | null; raf: number }>({
    on: false,
    next: null,
    raf: 0,
  });
  // Set at `ended`, read at the next `play`: measures the real-world gap of
  // hard swaps so we know the number crossfade is beating. DevTools only.
  const gapMarkRef = useRef<number | null>(null);

  const cancelCrossfade = useCallback(() => {
    const cf = crossfadeRef.current;
    if (!cf.on) return;
    cf.on = false;
    cf.next = null;
    cancelAnimationFrame(cf.raf);
    const v = volumeRef.current;
    for (const el of elementsRef.current) {
      if (el !== audioRef.current) el.pause();
      el.volume = v;
    }
  }, []);

  function previewUrlFor(t: PlayerTrack): string {
    return `/api/preview/${t.preview!.dropId}${
      t.preview!.trackId ? `?track=${t.preview!.trackId}` : ""
    }`;
  }

  const resolveTrackUrl = useCallback(async (t: PlayerTrack): Promise<string> => {
    if (t.preview) return previewUrlFor(t);
    const cached = urlCacheRef.current.get(t.trackId);
    if (cached && Date.now() - cached.at < URL_FRESH_MS) return cached.url;
    const res = await fetch(`/api/stream/${t.trackId}`);
    if (!res.ok) throw new Error("stream failed");
    const { url } = (await res.json()) as { url: string };
    urlCacheRef.current.set(t.trackId, { url, at: Date.now() });
    return url;
  }, []);

  const loadAndPlay = useCallback(async (nextTrack: PlayerTrack, opts?: { silentAutoplay?: boolean }) => {
    const audio = audioRef.current;
    if (!audio) return;
    cancelCrossfade();
    const epoch = ++loadEpochRef.current;
    setError(false);
    setLoading(true);
    setTrack(nextTrack);
    const key = cacheKeyFor(nextTrack);
    // A blocked programmatic start is silence, not failure -- but only when
    // the caller explicitly asked for silent autoplay. Everything else
    // (dead URLs, 403s, network drops) still raises the error UI.
    const notePlayRejection = (e: unknown) => {
      if (
        opts?.silentAutoplay &&
        e instanceof DOMException &&
        e.name === "NotAllowedError"
      )
        return;
      if (loadEpochRef.current === epoch) setError(true);
    };
    try {
      // Fast path: the standby element already has this track buffered
      // (put there by the prefetch effect) -- swap it in and play at once.
      const standby = elementsRef.current.find((el) => el !== audio);
      if (standby && standbyKeyRef.current === key && standby.readyState >= 2) {
        audio.pause();
        standby.volume = audio.volume;
        audioRef.current = standby;
        // The old active element becomes the new standby, still holding the
        // track we just left -- stepping back to it is instant too.
        // (trackRef is still the previous track here: setTrack above hasn't
        // re-rendered yet, which is exactly what we want.)
        const prev = trackRef.current;
        standbyKeyRef.current = audio.src && prev ? cacheKeyFor(prev) : null;
        setCurrentTime(0);
        setDuration(standby.duration || 0);
        await standby.play().catch(notePlayRejection);
        return;
      }
      const url = await resolveTrackUrl(nextTrack);
      if (loadEpochRef.current !== epoch) return;
      audio.src = url;
      await audio.play().catch(notePlayRejection);
    } catch {
      if (loadEpochRef.current === epoch) setError(true);
    } finally {
      if (loadEpochRef.current === epoch) setLoading(false);
    }
  }, [resolveTrackUrl, cancelCrossfade]);

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

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    cancelCrossfade();
    const clamped = trackRef.current?.preview ? Math.min(time, PREVIEW_SECONDS) : time;
    // Some browsers (notably Safari/iOS) implicitly pause the element while
    // it rebuffers around the new position and won't resume on their own --
    // re-issuing play() here is a no-op if it was already paused/never
    // playing, but is required to actually resume when it was playing.
    const wasPlaying = !audio.paused;
    audio.currentTime = clamped;
    setCurrentTime(clamped);
    if (wasPlaying) audio.play().catch(() => {});
  }, [cancelCrossfade]);

  useEffect(() => {
    const makeEl = () => {
      const el = new Audio();
      el.preload = "auto";
      el.volume = initialVolumeRef.current;
      return el;
    };
    const [elA, elB] = [makeEl(), makeEl()];
    elementsRef.current = [elA, elB];
    audioRef.current = elA;

    const isActive = (el: HTMLAudioElement) => audioRef.current === el;

    const updatePositionState = (el: HTMLAudioElement) => {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      try {
        const d = el.duration;
        if (!Number.isFinite(d) || d <= 0) return;
        // Previews stop at the cap, so report the cap as the duration --
        // otherwise the lock-screen progress bar runs past the cut-off.
        const t = trackRef.current;
        const duration = t?.preview ? Math.min(d, PREVIEW_SECONDS) : d;
        navigator.mediaSession.setPositionState({
          duration,
          position: Math.min(el.currentTime, duration),
          playbackRate: el.playbackRate || 1,
        });
      } catch {
        // setPositionState throws if metadata isn't set yet -- harmless.
      }
    };

    const onTimeUpdate = (el: HTMLAudioElement) => () => {
      if (!isActive(el)) return;
      setCurrentTime(el.currentTime);
      updatePositionState(el);
      maybeStartCrossfade(el);
      if (trackRef.current?.preview && el.currentTime >= PREVIEW_SECONDS) {
        el.pause();
        el.currentTime = 0;
        step(1);
      }
    };
    const onLoadedMetadata = (el: HTMLAudioElement) => () => {
      if (!isActive(el)) return;
      setDuration(el.duration || 0);
      updatePositionState(el);
    };
    const onDuration = (el: HTMLAudioElement) => () => {
      if (!isActive(el)) return;
      setDuration(el.duration || 0);
    };
    const onPlay = (el: HTMLAudioElement) => () => {
      if (!isActive(el)) return;
      setPlaying(true);
      updatePositionState(el);
      if (gapMarkRef.current !== null) {
        const gap = performance.now() - gapMarkRef.current;
        gapMarkRef.current = null;
        console.debug(`[player] track gap: ${Math.round(gap)}ms`);
      }
    };
    const onPause = (el: HTMLAudioElement) => () => {
      if (!isActive(el)) return;
      setPlaying(false);
    };
    const onEnded = (el: HTMLAudioElement) => () => {
      if (!isActive(el)) return;
      setPlaying(false);
      gapMarkRef.current = performance.now();
      if (repeatModeRef.current === "one") {
        el.currentTime = 0;
        el.play().catch(() => setError(true));
        return;
      }
      step(1);
    };
    const onError = (el: HTMLAudioElement) => () => {
      if (!isActive(el)) return;
      setError(true);
      setLoading(false);
    };

    const unsubs: (() => void)[] = [];
    for (const el of [elA, elB]) {
      const handlers: [string, () => void][] = [
        ["timeupdate", onTimeUpdate(el)],
        ["loadedmetadata", onLoadedMetadata(el)],
        ["durationchange", onDuration(el)],
        ["play", onPlay(el)],
        ["pause", onPause(el)],
        ["ended", onEnded(el)],
        ["error", onError(el)],
      ];
      for (const [evt, fn] of handlers) {
        el.addEventListener(evt, fn);
        unsubs.push(() => el.removeEventListener(evt, fn));
      }
    }

    const active = () => audioRef.current ?? elA;

    // Crossfade: when the active track enters its final CROSSFADE_SECONDS
    // with the next track already buffered on the standby element, start the
    // standby at zero volume and ramp the two against each other. At the end
    // of the ramp the swap bookkeeping runs (same as the instant fast path).
    // Skipped for previews (hard cut at the cap), repeat-one (same track),
    // and shuffle (next pick is random, nothing preloaded). Any manual
    // intervention -- seek/pause/skip via cancelCrossfade -- aborts the fade
    // and restores volumes, so the fade can never wedge playback.
    const finishCrossfade = (el: HTMLAudioElement, standby: HTMLAudioElement) => {
      const cf = crossfadeRef.current;
      cf.on = false;
      const next = cf.next;
      cf.next = null;
      const v = volumeRef.current;
      el.volume = v;
      standby.volume = v;
      audioRef.current = standby;
      const prev = trackRef.current;
      standbyKeyRef.current = el.src && prev ? cacheKeyFor(prev) : null;
      el.pause();
      if (next) {
        setCurrentTime(0);
        setDuration(standby.duration || 0);
        setTrack(next);
      }
      console.debug("[player] crossfade complete");
    };

    const maybeStartCrossfade = (el: HTMLAudioElement) => {
      const cf = crossfadeRef.current;
      if (cf.on) return;
      const t = trackRef.current;
      if (!t || t.preview) return;
      if (repeatModeRef.current === "one" || shuffleRef.current) return;
      const d = el.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const remaining = d - el.currentTime;
      if (remaining > CROSSFADE_SECONDS || remaining <= 0.05) return;
      const q = queueRef.current;
      const idx = q.findIndex((x) => x.trackId === t.trackId);
      if (idx === -1) return;
      let next = q[idx + 1];
      if (!next && repeatModeRef.current === "all" && q.length > 0) next = q[0];
      if (!next || next.trackId === t.trackId) return;
      const key = cacheKeyFor(next);
      const standby = elementsRef.current.find((x) => x !== el);
      if (!standby || standbyKeyRef.current !== key || standby.readyState < 2) return;
      cf.on = true;
      cf.next = next;
      try {
        standby.currentTime = 0;
      } catch {
        // Not yet seekable -- still at 0 from a fresh load.
      }
      standby.volume = 0;
      standby.play().catch(() => {
        cf.on = false;
        cf.next = null;
      });
      const startedAt = performance.now();
      const rampMs = Math.max(remaining * 1000, 1);
      console.debug("[player] crossfade engaged");
      const tick = () => {
        if (!crossfadeRef.current.on) return;
        const p = Math.min((performance.now() - startedAt) / rampMs, 1);
        const v = volumeRef.current;
        el.volume = v * (1 - p);
        standby.volume = v * p;
        if (p >= 1) finishCrossfade(el, standby);
        else cf.raf = requestAnimationFrame(tick);
      };
      cf.raf = requestAnimationFrame(tick);
    };

    // Lets iOS/Android show the track title, artist, and artwork on the
    // lock screen and Control Center instead of just the page title and a
    // generic app icon, and lets the hardware/lock-screen prev-next buttons
    // (rather than the generic 10s skip buttons browsers fall back to)
    // drive the actual queue. seekto wires the lock-screen scrubber to our
    // seek (clamped to the preview cap for previews); without it the
    // scrubber renders but does nothing.
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => active().play().catch(() => setError(true)));
      navigator.mediaSession.setActionHandler("pause", () => active().pause());
      navigator.mediaSession.setActionHandler("stop", () => active().pause());
      navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (typeof details.seekTime === "number") seek(details.seekTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const el = active();
        seek(el.currentTime - (details.seekOffset ?? 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const el = active();
        seek(el.currentTime + (details.seekOffset ?? 10));
      });
    }

    return () => {
      unsubs.forEach((off) => off());
      elA.pause();
      elB.pause();
      elementsRef.current = [];
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("stop", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("seekto", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
      }
    };
  }, [step, seek]);

  // Prefetches the deterministic next track (skipped under shuffle, where
  // the next pick is random) once the current one can play -- loaded into
  // the STANDBY element so advancing swaps it in with no rebuffer gap. No
  // setState here, only refs: safe to run on every track/queue change.
  useEffect(() => {
    if (!track || queue.length === 0 || shuffle) return;
    const idx = queue.findIndex((t) => t.trackId === track.trackId);
    if (idx === -1) return;
    let next = queue[idx + 1];
    if (!next && repeatMode === "all" && queue.length > 0) next = queue[0];
    if (!next || next.trackId === track.trackId) return;
    const key = cacheKeyFor(next);

    let cancelled = false;
    const warm = () => {
      resolveTrackUrl(next)
        .then((url) => {
          if (cancelled) return;
          const standby = elementsRef.current.find((el) => el !== audioRef.current);
          if (!standby || cancelled) return;
          if (standbyKeyRef.current === key) {
            // Already assigned: leave it alone while it has data or is still
            // loading, retry only if it previously errored out.
            if (standby.readyState >= 2 || standby.networkState === 2) return;
            if (standby.networkState !== 3 && standby.networkState !== 0) return;
          }
          standbyKeyRef.current = key;
          if (standby.src !== url) standby.src = url;
          else standby.load();
        })
        .catch(() => {});
    };

    const main = audioRef.current;
    if (main && main.readyState >= 3) {
      warm();
    } else if (main) {
      main.addEventListener("canplay", warm, { once: true });
    } else {
      warm();
    }
    return () => {
      cancelled = true;
      main?.removeEventListener("canplay", warm);
    };
  }, [track, queue, shuffle, repeatMode, resolveTrackUrl]);

  // Refreshes the lock-screen/Control Center metadata whenever the active
  // track changes -- falls back to the same deterministic artwork used
  // elsewhere in the app when a track has no artwork of its own.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const artwork = track.artworkUrl || artworkFallback(track.trackId);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artistName,
      artwork: [
        { src: artwork, sizes: "512x512", type: "image/png" },
        { src: artwork, sizes: "256x256", type: "image/png" },
        { src: artwork, sizes: "96x96", type: "image/png" },
      ],
    });
  }, [track]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  const play = useCallback(
    (nextTrack: PlayerTrack, nextQueue?: PlayerTrack[], opts?: { silentAutoplay?: boolean }) => {
      setQueue(nextQueue ?? [nextTrack]);
      const audio = audioRef.current;
      // Preview and full versions share a trackId -- resume only when the
      // mode matches too, otherwise a tap on the owned full track would just
      // resume the 30s preview already playing (and vice versa).
      if (
        track?.trackId === nextTrack.trackId &&
        !!track?.preview === !!nextTrack.preview &&
        audio?.src
      ) {
        audio.play().catch(() => setError(true));
        return;
      }
      loadAndPlay(nextTrack, opts);
    },
    [track, loadAndPlay],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) {
      audio.play().catch(() => setError(true));
    } else {
      cancelCrossfade();
      audio.pause();
    }
  }, [track, cancelCrossfade]);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    const audio = audioRef.current;
    if (audio) audio.volume = clamped;
    setVolumeState(clamped);
    try {
      window.localStorage.setItem("preem-volume", String(clamped));
    } catch {
      // Private browsing / storage disabled -- volume just won't persist.
    }
  }, []);

  const next = useCallback(() => {
    step(1);
  }, [step]);

  const previous = useCallback(() => {
    step(-1);
  }, [step]);

  // Dismissing the bar: stop playback and drop the audio elements' sources
  // so the browser stops buffering, then wipe all visible state.
  const close = useCallback(() => {
    cancelCrossfade();
    for (const el of elementsRef.current) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    standbyKeyRef.current = null;
    setTrack(null);
    setQueue([]);
    setCurrentTime(0);
    setDuration(0);
    setError(false);
    setLoading(false);
    setPlaying(false);
  }, [cancelCrossfade]);

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
         volume,
         setVolume,
         next,
         previous,
         close,
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
