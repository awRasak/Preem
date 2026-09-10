"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ListMusic, Volume1, Volume2, VolumeX, X } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { artworkFallback } from "@/lib/placeholder";
import { PREVIEW_SECONDS } from "@/lib/preview";
import { activeLrcLine, parseLrc } from "@/lib/lrc";
import {
  NextTrackIcon,
  PauseIcon,
  PlayIcon,
  PreviousTrackIcon,
  RepeatIcon,
  ShuffleIcon,
} from "@/components/Icons";
import { GiftButton } from "@/components/GiftButton";
import { Spinner } from "@/components/Loader";

// Calling seek() on every onChange tick during a drag -- which is what a
// naive controlled range input does -- re-seeks the underlying (byte-range
// streamed) audio dozens of times per drag, and can race with the browser's
// own seek-buffering and leave playback paused. Track the live drag value
// locally instead, and only commit the real seek once the gesture ends.
function SeekInput({
  currentTime,
  duration,
  onSeek,
  className,
  ariaLabel,
}: {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  className: string;
  ariaLabel?: string;
}) {
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  function commit(e: React.SyntheticEvent<HTMLInputElement>) {
    onSeek(Number(e.currentTarget.value));
    setScrubValue(null);
  }

  return (
    <input
      type="range"
      min={0}
      max={duration || 0}
      step={0.1}
      value={scrubValue ?? Math.min(currentTime, duration || currentTime)}
      onChange={(e) => setScrubValue(Number(e.target.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Screen = "none" | "now" | "queue";

export function PlayerBar() {
  const {
    track,
    queue,
    playing,
    loading,
    currentTime,
    duration,
    error,
    toggle,
    seek,
    next,
    previous,
    close,
    hasNext,
    hasPrevious,
    repeatMode,
    cycleRepeat,
    shuffle,
    toggleShuffle,
    volume,
    setVolume,
  } = usePlayer();
  const [screen, setScreen] = useState<Screen>("none");

  if (!track) return null;

  const displayDuration = track.preview ? Math.min(duration || PREVIEW_SECONDS, PREVIEW_SECONDS) : duration;
  const progressPct = displayDuration > 0 ? Math.min(100, (currentTime / displayDuration) * 100) : 0;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {/* Dismiss control: deliberately straddles the container's top edge
            (half on the bar, half above it) so it reads as "close the whole
            player", not as one more bar button. */}
        <button
          onClick={close}
          aria-label="Close player"
          className="absolute -top-3 right-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-md hover:text-paper"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Mobile mini-player: a thin progress line at the top edge instead of
            a full slider row, same treatment Spotify uses on its compact
            bottom bar -- the full seek bar + time labels only show at sm+,
            where there's room for them without squeezing everything else. */}
        <div className="h-[2px] w-full bg-line-strong sm:hidden">
          <div className="h-full bg-accent" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5 sm:py-3 sm:px-8">
          <button
            type="button"
            onClick={() => setScreen("now")}
            aria-label="Open now playing screen"
            className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2"
          >
            <Image
              src={track.artworkUrl || artworkFallback(track.trackId)}
              alt={track.title}
              fill
              className="object-cover"
              sizes="44px"
            />
          </button>

          <button
            type="button"
            onClick={() => setScreen("now")}
            aria-label="Open now playing screen"
            className="min-w-0 flex-1 text-left sm:flex-shrink-0 sm:w-40"
          >
            <div className="truncate text-sm font-medium">{track.title}</div>
            <div className="truncate text-xs text-muted">
              <span
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Link href={`/artist/${track.artistId}`} className="hover:text-paper hover:underline">
                  {track.artistName}
                </Link>
              </span>
              {track.preview && <span className="ml-1.5 text-accent">· Preview</span>}
            </div>
          </button>

          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              onClick={previous}
              disabled={!hasPrevious || loading}
              aria-label="Previous track"
              className="hidden h-8 w-8 items-center justify-center rounded-full text-muted hover:text-paper disabled:opacity-30 disabled:hover:text-muted sm:flex"
            >
              <PreviousTrackIcon className="h-4 w-4" />
            </button>
            <button
              onClick={toggle}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-paper disabled:opacity-50 sm:h-9 sm:w-9"
            >
              {loading ? (
                <Spinner size="xs" />
              ) : playing ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={next}
              disabled={!hasNext || loading}
              aria-label="Next track"
              className="hidden h-8 w-8 items-center justify-center rounded-full text-muted hover:text-paper disabled:opacity-30 disabled:hover:text-muted sm:flex"
            >
              <NextTrackIcon className="h-4 w-4" />
            </button>
          </div>

          <span className="hidden font-mono text-[11px] text-muted sm:inline">
            {formatTime(currentTime)}
          </span>

          <SeekInput
            currentTime={currentTime}
            duration={displayDuration}
            onSeek={seek}
            ariaLabel="Seek"
            className="hidden h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line-strong accent-accent sm:block"
          />

          <span className="hidden font-mono text-[11px] text-muted sm:inline">
            {formatTime(displayDuration)}
          </span>

          <div className="hidden flex-shrink-0 items-center gap-1 sm:flex">
            <button
              onClick={toggleShuffle}
              aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
              aria-pressed={shuffle}
              className={`flex h-8 w-8 items-center justify-center rounded-full hover:text-paper ${
                shuffle ? "text-accent" : "text-muted"
              }`}
            >
              <ShuffleIcon className="h-4 w-4" />
            </button>
            <button
              onClick={cycleRepeat}
              aria-label={`Repeat: ${repeatMode}`}
              aria-pressed={repeatMode !== "off"}
              className={`relative flex h-8 w-8 items-center justify-center rounded-full hover:text-paper ${
                repeatMode !== "off" ? "text-accent" : "text-muted"
              }`}
            >
              <RepeatIcon className="h-4 w-4" />
              {repeatMode === "one" && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-[#1a0d05]">
                  1
                </span>
              )}
            </button>
            <button
              onClick={() => setScreen("queue")}
              aria-label="Open queue"
              aria-pressed={screen === "queue"}
              className={`relative flex h-8 w-8 items-center justify-center rounded-full hover:text-paper ${
                screen === "queue" ? "text-accent" : "text-muted"
              }`}
            >
              <ListMusic className="h-4 w-4" />
              {queue.length > 1 && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold leading-none text-[#1a0d05]">
                  {queue.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden flex-shrink-0 items-center gap-1.5 lg:flex">
            <VolumeControl volume={volume} setVolume={setVolume} />
          </div>

          {/* Desktop: compact pill sits right in the control row instead of
              taking its own full-width row below. */}
          {track.artistId && (
            <div className="hidden flex-shrink-0 sm:block">
              <GiftButton
                artistId={track.artistId}
                artistName={track.artistName}
                variant="button"
              />
            </div>
          )}

          {error && (
            <span className="text-xs text-[#ff6b6b]">Playback failed</span>
          )}
        </div>

        {track.artistId && (
          <div className="sm:hidden">
            <GiftButton
              artistId={track.artistId}
              artistName={track.artistName}
              artworkUrl={track.artworkUrl}
              variant="row"
            />
          </div>
        )}
      </div>

      {screen === "now" && <NowPlayingScreen onClose={() => setScreen("none")} />}
      {screen === "queue" && <QueueScreen onClose={() => setScreen("none")} />}
    </>
  );
}

function VolumeControl({
  volume,
  setVolume,
}: {
  volume: number;
  setVolume: (v: number) => void;
}) {
  const lastNonZeroRef = useRef(volume || 1);
  useEffect(() => {
    if (volume > 0) lastNonZeroRef.current = volume;
  }, [volume]);

  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      <button
        type="button"
        onClick={() => setVolume(volume === 0 ? lastNonZeroRef.current : 0)}
        aria-label={volume === 0 ? "Unmute" : "Mute"}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-paper"
      >
        <Icon className="h-4 w-4" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-line-strong accent-accent"
      />
    </>
  );
}

function ScreenHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-5 pb-2 pt-4">
      <button
        onClick={onClose}
        aria-label="Back to player bar"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted hover:text-paper"
      >
        <ChevronDown className="h-5 w-5" />
      </button>
      <p className="min-w-0 flex-1 truncate text-center text-[11px] font-bold uppercase tracking-wide text-muted">
        {title}
      </p>
      {/* Spacer mirrors the close button so the title stays centered. */}
      <span className="h-9 w-9 flex-shrink-0" />
    </div>
  );
}

function TransportControls() {
  const {
    playing,
    loading,
    toggle,
    next,
    previous,
    hasNext,
    hasPrevious,
    repeatMode,
    cycleRepeat,
    shuffle,
    toggleShuffle,
  } = usePlayer();

  return (
    <div className="flex items-center justify-center gap-5">
      <button
        onClick={toggleShuffle}
        aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
        aria-pressed={shuffle}
        className={shuffle ? "text-accent" : "text-muted hover:text-paper"}
      >
        <ShuffleIcon className="h-4.5 w-4.5" />
      </button>
      <button
        onClick={previous}
        disabled={!hasPrevious || loading}
        aria-label="Previous track"
        className="text-paper disabled:opacity-30"
      >
        <PreviousTrackIcon className="h-6 w-6" />
      </button>
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-paper disabled:opacity-50"
      >
        {loading ? (
          <Spinner size="sm" />
        ) : playing ? (
          <PauseIcon className="h-6 w-6" />
        ) : (
          <PlayIcon className="h-6 w-6" />
        )}
      </button>
      <button
        onClick={next}
        disabled={!hasNext || loading}
        aria-label="Next track"
        className="text-paper disabled:opacity-30"
      >
        <NextTrackIcon className="h-6 w-6" />
      </button>
      <button
        onClick={cycleRepeat}
        aria-label={`Repeat: ${repeatMode}`}
        aria-pressed={repeatMode !== "off"}
        className={`relative ${repeatMode !== "off" ? "text-accent" : "text-muted hover:text-paper"}`}
      >
        <RepeatIcon className="h-4.5 w-4.5" />
        {repeatMode === "one" && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-[#1a0d05]">
            1
          </span>
        )}
      </button>
    </div>
  );
}

function SeekRow() {
  const { currentTime, duration, seek, track } = usePlayer();
  const displayDuration = track?.preview
    ? Math.min(duration || PREVIEW_SECONDS, PREVIEW_SECONDS)
    : duration;

  return (
    <div className="flex w-full items-center gap-3">
      <span className="font-mono text-[11px] text-muted">{formatTime(currentTime)}</span>
      <SeekInput
        currentTime={currentTime}
        duration={displayDuration}
        onSeek={seek}
        ariaLabel="Seek"
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line-strong accent-accent"
      />
      <span className="font-mono text-[11px] text-muted">{formatTime(displayDuration)}</span>
    </div>
  );
}

function NowPlayingScreen({ onClose }: { onClose: () => void }) {
  const { track } = usePlayer();
  const [tab, setTab] = useState<"playing" | "lyrics">("playing");
  if (!track) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <ScreenHeader
        title={
          track.collectionTitle ? `Playing from ${track.collectionTitle}` : track.artistName
        }
        onClose={onClose}
      />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {/* Tab switcher */}
        <div className="mb-6 flex justify-center">
          <div className="flex rounded-full border border-line p-0.5">
            {(["playing", "lyrics"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`rounded-full px-5 py-1.5 text-xs font-bold capitalize transition-colors ${
                  tab === t ? "bg-paper text-surface" : "text-muted hover:text-paper"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {tab === "playing" ? (
            <div className="flex flex-col items-center">
              <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-xl bg-surface-2 shadow-xl">
                <Image
                  src={track.artworkUrl || artworkFallback(track.trackId)}
                  alt={track.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 80vw, 300px"
                  priority
                />
              </div>
              <div className="mt-6 w-full text-center">
                <h2 className="truncate text-xl font-bold">{track.title}</h2>
                <p className="mt-1 truncate text-sm text-muted">
                  {track.artistName}
                  {track.preview && <span className="ml-1.5 text-accent">· Preview</span>}
                </p>
              </div>
            </div>
          ) : (
            <LyricsView />
          )}
        </div>

        <div className="mt-8 space-y-4">
          <SeekRow />
          <TransportControls />
        </div>
      </div>
    </div>
  );
}

/** Lyrics tab. With LRC data: Spotify-style karaoke view -- the active line
 *  highlights and auto-centers as playback advances, tapping any line seeks
 *  there. Without LRC: a plain lyric sheet; with nothing: an empty state. */
function LyricsView() {
  const { track, currentTime, seek } = usePlayer();
  const lyricsLrc = track?.lyricsLrc ?? null;
  const lines = useMemo(() => (lyricsLrc ? parseLrc(lyricsLrc) : []), [lyricsLrc]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const activeIndex = lines.length > 0 ? activeLrcLine(lines, currentTime) : -1;

  // Keep the sung line vertically centered, Spotify-style.
  useEffect(() => {
    const container = containerRef.current;
    const el = activeRef.current;
    if (activeIndex < 0 || !container || !el) return;
    const target = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex]);

  if (!track) return null;

  if (lines.length === 0) {
    if (track.lyrics) {
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="whitespace-pre-line text-lg font-medium leading-relaxed text-paper/90">
            {track.lyrics}
          </p>
        </div>
      );
    }
    return (
      <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center text-center">
        <MicPlaceholder />
        <p className="mt-4 text-sm font-bold">No lyrics yet</p>
        <p className="mt-1 max-w-[240px] text-xs text-muted">
          The artist hasn&apos;t added lyrics for this track.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 scroll-py-[40vh] overflow-y-auto py-[38vh]"
      aria-live="polite"
    >
      {lines.map((line, i) => (
        <button
          key={`${line.time}-${i}`}
          ref={i === activeIndex ? activeRef : undefined}
          onClick={() => seek(line.time)}
          aria-label={`Seek to ${formatTime(line.time)}`}
          className={`block w-full text-left transition-all duration-300 ${
            i === activeIndex
              ? "text-xl font-bold text-paper"
              : i < activeIndex
                ? "text-base font-medium text-muted/50"
                : "text-lg font-medium text-muted/80 hover:text-paper/80"
          } ${line.text ? "" : "py-2"}`}
        >
          {line.text || "♪"}
        </button>
      ))}
    </div>
  );
}

function MicPlaceholder() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function QueueScreen({ onClose }: { onClose: () => void }) {
  const { queue, track, play } = usePlayer();
  const currentCollection =
    queue.find((t) => t.trackId === track?.trackId)?.collectionTitle ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <ScreenHeader title="Queue" onClose={onClose} />
      <p className="px-6 pb-3 text-[11px] font-bold uppercase tracking-wide text-muted">
        {currentCollection ? `Playing from ${currentCollection}` : `${queue.length} tracks`}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {queue.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">Nothing queued.</p>
        ) : (
          <ul className="divide-y divide-line">
            {queue.map((item, index) => {
              const isCurrent = item.trackId === track?.trackId;
              return (
                <li key={`${item.trackId}-${index}`}>
                  <button
                    onClick={() => play(item, queue)}
                    className={`flex w-full items-center gap-3 py-3 text-left ${
                      isCurrent ? "text-accent" : "hover:bg-surface-2/50"
                    }`}
                  >
                    <span className="w-6 flex-shrink-0 text-center font-mono text-[11px] text-muted">
                      {isCurrent ? (
                        <EqBars />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {item.artistName}
                        {item.preview && <span className="ml-1.5 text-accent">· Preview</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function EqBars() {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-end justify-center gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] animate-pulse rounded-sm bg-accent"
          style={{ height: `${[60, 100, 40][i]}%`, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
