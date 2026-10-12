import type { ReleaseInput } from "./provider";

export type DropForDistribution = {
  id: string;
  title: string;
  release_type: "single" | "ep" | "album";
  genre: string | null;
  window_end: string | null;
  artwork_path: string | null;
  artist: { stage_name: string };
};

export type TrackForDistribution = {
  id: string;
  title: string;
  track_number: number;
  audio_file_path: string | null;
  collaborators: string | null;
  lyrics: string | null;
  lyrics_lrc: string | null;
};

// Preem genres are already display strings via genreLabel(); providers take
// free-text primary genres, so pass through with an "Other" fallback.
export function mapGenre(genre: string | null): string {
  if (!genre || genre === "other") return "Afrobeats";
  return genre
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function mapReleaseType(releaseType: string): ReleaseInput["releaseType"] {
  if (releaseType === "ep") return "EP";
  if (releaseType === "album") return "Album";
  return "Single";
}

// Street date: explicit override wins, else the window end (the DSP street
// date IS the countdown end -- pre-submit during the countdown, go live as
// the Preem window closes). Falls back to today for already-closed windows.
export function streetDateFor(
  windowEnd: string | null,
  override: string | null,
): string {
  if (override) return override;
  if (windowEnd) {
    const d = new Date(windowEnd);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export function mapDropToRelease(
  drop: DropForDistribution,
  tracks: TrackForDistribution[],
  streetDate: string,
): ReleaseInput {
  return {
    title: drop.title,
    artistName: drop.artist.stage_name,
    releaseType: mapReleaseType(drop.release_type),
    genre: mapGenre(drop.genre),
    releaseDate: streetDate,
    labelName: "Preem",
    copyrightYear: new Date(streetDate).getFullYear(),
    tracks: tracks.map((t) => ({
      title: t.title,
      trackNumber: t.track_number,
      ...(t.collaborators ? { featuredNames: t.collaborators } : {}),
      ...((t.lyrics_lrc || t.lyrics) ? { lyrics: t.lyrics_lrc ?? t.lyrics ?? undefined } : {}),
    })),
  };
}

// Lead-time guard: Boomplay-class stores want ~2 weeks. Warn (don't block)
// when the street date is closer than this.
export const LEAD_TIME_WARN_DAYS = 14;

export function leadTimeDays(streetDate: string): number {
  const ms = new Date(`${streetDate}T00:00:00`).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
