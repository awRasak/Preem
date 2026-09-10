import type { Genre } from "@/lib/types";

export type ReleaseType = "single" | "ep" | "album";
export type DropType = "early-access" | "exclusive";

// Explicit picker filter for track uploads. A bare "audio/*" lets some
// mobile pickers hide .wav files, so MP3 and WAV are listed by both MIME
// type and extension.
export const AUDIO_ACCEPT =
  "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave,.mp3,.wav";

export type TrackDraft = {
  localId: string;
  file: File | null;
  // Set at autosave time when a file was attached but couldn't be
  // persisted -- lets the resume UI say "re-attach" honestly.
  hadFile: boolean;
  title: string;
  minPriceNaira: string;
  collaborators: string;
  lyrics: string;
  expanded: boolean;
};

export type WizardState = {
  artworkFile: File | null;
  artworkPreviewUrl: string | null;
  title: string;
  releaseType: ReleaseType;
  dropType: DropType;
  genre: Genre;
  secondaryGenre: Genre | "";
  description: string;
  singleAudioFile: File | null;
  tracks: TrackDraft[];
  minPriceNaira: string;
  releaseDate: string;
};

export function defaultReleaseDate(): string {
  const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function newTrackDraft(title = ""): TrackDraft {
  return {
    localId: crypto.randomUUID(),
    file: null,
    hadFile: false,
    title,
    minPriceNaira: "",
    collaborators: "",
    lyrics: "",
    expanded: false,
  };
}

export function initialWizardState(): WizardState {
  return {
    artworkFile: null,
    artworkPreviewUrl: null,
    title: "",
    releaseType: "single",
    dropType: "early-access",
    genre: "other",
    secondaryGenre: "",
    description: "",
    singleAudioFile: null,
    tracks: [],
    minPriceNaira: "",
    releaseDate: defaultReleaseDate(),
  };
}

// Autosave: the wizard persists to localStorage as the artist types, so a
// refresh, closed tab, or "I'll finish this tonight" never loses the
// session. File objects (audio, artwork) can't survive serialization --
// they're stripped on save and the artist re-attaches them on resume,
// which the UI calls out explicitly.
const DRAFT_VERSION = 1;

export function draftStorageKey(userId: string) {
  return `preem:drop-draft:${userId}`;
}

export type RestoredDraft = {
  step: number;
  state: WizardState;
  savedAt: string;
  hadFiles: boolean;
};

export function isEmptyDraft(state: WizardState): boolean {
  return (
    !state.title.trim() &&
    !state.description.trim() &&
    state.tracks.length === 0 &&
    !state.minPriceNaira.trim() &&
    state.singleAudioFile === null &&
    state.artworkFile === null
  );
}

export function serializeDraft(step: unknown, state: WizardState): string {
  return JSON.stringify({
    v: DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    step: typeof step === "number" ? step : 1,
    singleHadFile: state.singleAudioFile !== null,
    artworkHadFile: state.artworkFile !== null,
    state: {
      ...state,
      artworkFile: null,
      artworkPreviewUrl: null,
      singleAudioFile: null,
      tracks: state.tracks.map((t) => ({ ...t, file: null, hadFile: t.file !== null })),
    },
  });
}

export function parseDraft(raw: string): RestoredDraft | null {
  try {
    const parsed = JSON.parse(raw) as {
      v?: number;
      savedAt?: string;
      step?: number;
      singleHadFile?: boolean;
      artworkHadFile?: boolean;
      state?: WizardState & { tracks?: (TrackDraft & { hadFile?: boolean })[] };
    };
    if (!parsed || parsed.v !== DRAFT_VERSION || !parsed.state) return null;
    const s = parsed.state;
    if (typeof s.title !== "string" || !Array.isArray(s.tracks)) return null;
    const state: WizardState = {
      ...initialWizardState(),
      ...s,
      artworkFile: null,
      artworkPreviewUrl: null,
      singleAudioFile: null,
      tracks: (s.tracks ?? []).map((t) => ({
        ...newTrackDraft(typeof t.title === "string" ? t.title : ""),
        ...t,
        file: null,
      })),
    };
    if (isEmptyDraft(state)) return null;
    const hadFiles = Boolean(
      parsed.singleHadFile ||
        parsed.artworkHadFile ||
        (s.tracks ?? []).some((t) => t.hadFile),
    );
    return {
      step: parsed.step && parsed.step >= 1 && parsed.step <= 4 ? parsed.step : 1,
      state,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      hadFiles,
    };
  } catch {
    return null;
  }
}
