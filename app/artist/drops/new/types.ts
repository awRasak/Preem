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
  description: string;
  singleAudioFile: File | null;
  tracks: TrackDraft[];
  minPriceNaira: string;
  windowHours: number;
};

export const WINDOW_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "72 hours", hours: 72 },
];

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
    description: "",
    singleAudioFile: null,
    tracks: [],
    minPriceNaira: "",
    windowHours: 48,
  };
}
