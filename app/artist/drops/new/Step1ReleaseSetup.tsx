"use client";

import { Field, Textarea } from "@/components/Field";
import { newTrackDraft } from "./types";
import type { DropType, ReleaseType, WizardState } from "./types";

const RELEASE_TYPES: { value: ReleaseType; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
];

const DROP_TYPES: { value: DropType; label: string; blurb: string }[] = [
  {
    value: "early-access",
    label: "Early access",
    blurb: "Window closes, then you distribute it elsewhere",
  },
  {
    value: "exclusive",
    label: "Exclusive",
    blurb: "Stays on Preem only, for as long as you want",
  },
];

export function Step1ReleaseSetup({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  function handleReleaseType(releaseType: ReleaseType) {
    if (releaseType === "single") {
      onChange({ releaseType, tracks: [] });
    } else {
      onChange({ releaseType, singleAudioFile: null });
    }
  }

  function handleTracklistFiles(files: FileList | null) {
    if (!files) return;
    const drafts = Array.from(files).map((file) => {
      const draft = newTrackDraft(file.name.replace(/\.[^/.]+$/, ""));
      draft.file = file;
      return draft;
    });
    onChange({ tracks: [...state.tracks, ...drafts] });
  }

  return (
    <div>
      <Field label="Type of release">
        <div className="flex gap-2">
          {RELEASE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleReleaseType(t.value)}
              className={`flex-1 rounded-full border px-3 py-2 text-xs font-bold ${
                state.releaseType === t.value
                  ? "border-accent bg-surface-2 text-paper"
                  : "border-line text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Drop type">
        <div className="flex gap-2">
          {DROP_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ dropType: t.value })}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-left text-xs ${
                state.dropType === t.value
                  ? "border-accent bg-surface-2"
                  : "border-line bg-surface"
              }`}
            >
              <div className="font-bold text-paper">{t.label}</div>
              <div className="mt-0.5 text-muted">{t.blurb}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Description (optional)">
        <Textarea
          rows={3}
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>

      {state.releaseType === "single" ? (
        <Field label="Track file">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => onChange({ singleAudioFile: e.target.files?.[0] ?? null })}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-bold file:text-paper"
          />
          {state.singleAudioFile && (
            <p className="mt-1.5 text-xs text-muted">{state.singleAudioFile.name}</p>
          )}
        </Field>
      ) : (
        <Field label="Tracklist">
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => handleTracklistFiles(e.target.files)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-bold file:text-paper"
          />
          <p className="mt-1.5 text-[11px] text-muted">
            MP3 or WAV · select every track — you&apos;ll set titles and prices next.
            {state.tracks.length > 0 && ` ${state.tracks.length} track${state.tracks.length === 1 ? "" : "s"} added.`}
          </p>
        </Field>
      )}
    </div>
  );
}
