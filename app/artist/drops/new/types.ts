import type { Genre } from "@/lib/types";

export type ReleaseType = "single" | "ep" | "album";
export type DropType = "early-access" | "exclusive";

export type TrackDraft = {
  localId: string;
  file: File | null;
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
