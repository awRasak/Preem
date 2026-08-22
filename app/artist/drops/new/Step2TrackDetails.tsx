"use client";

import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Field, Input, Textarea } from "@/components/Field";
import { Button } from "@/components/Button";
import { newTrackDraft } from "./types";
import type { TrackDraft, WizardState } from "./types";

export function Step2TrackDetails({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  function updateTrack(localId: string, patch: Partial<TrackDraft>) {
    onChange({
      tracks: state.tracks.map((t) => (t.localId === localId ? { ...t, ...patch } : t)),
    });
  }

  function removeTrack(localId: string) {
    onChange({ tracks: state.tracks.filter((t) => t.localId !== localId) });
  }

  function moveTrack(index: number, direction: -1 | 1) {
    const next = [...state.tracks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ tracks: next });
  }

  function addTrack() {
    onChange({ tracks: [...state.tracks, newTrackDraft()] });
  }

  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        Buying all tracks individually costs more in total than the bundle minimum —
        the bundle price is the discount for buying the full release.
      </p>
      <div className="space-y-3">
        {state.tracks.map((track, index) => (
          <div key={track.localId} className="rounded-xl border border-line p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex flex-shrink-0 flex-col gap-0.5 pt-2">
                <button
                  type="button"
                  onClick={() => moveTrack(index, -1)}
                  disabled={index === 0}
                  className="text-muted hover:text-paper disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTrack(index, 1)}
                  disabled={index === state.tracks.length - 1}
                  className="text-muted hover:text-paper disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex-shrink-0 text-xs font-bold text-muted">
                    {index + 1}.
                  </span>
                  <input
                    value={track.title}
                    onChange={(e) => updateTrack(track.localId, { title: e.target.value })}
                    placeholder="Track title"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-paper focus:border-line-strong focus:outline-none"
                  />
                </div>
                {track.file ? (
                  <p className="mb-2 text-xs text-muted">{track.file.name}</p>
                ) : (
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => updateTrack(track.localId, { file: e.target.files?.[0] ?? null })}
                    className="mb-2 block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-2.5 file:py-1.5 file:text-[11px] file:font-bold file:text-paper"
                  />
                )}
                <Input
                  type="number"
                  min={1}
                  value={track.minPriceNaira}
                  onChange={(e) => updateTrack(track.localId, { minPriceNaira: e.target.value })}
                  placeholder="Minimum Price (₦)"
                />
              </div>
              <button
                type="button"
                onClick={() => removeTrack(track.localId)}
                className="flex-shrink-0 text-muted hover:text-paper"
                aria-label="Remove track"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => updateTrack(track.localId, { expanded: !track.expanded })}
              className="text-[11px] font-bold text-muted underline hover:text-paper"
            >
              {track.expanded ? "Hide" : "Collaborators & lyrics"}
            </button>
            {track.expanded && (
              <div className="mt-3">
                <Field label="Collaborators (optional)">
                  <Input
                    value={track.collaborators}
                    onChange={(e) => updateTrack(track.localId, { collaborators: e.target.value })}
                    placeholder="e.g. Prod. by Sarz, feat. Amaarae"
                  />
                </Field>
                <Field label="Lyrics (optional)">
                  <Textarea
                    rows={4}
                    value={track.lyrics}
                    onChange={(e) => updateTrack(track.localId, { lyrics: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" className="mt-3 w-full !py-2.5 text-xs" onClick={addTrack}>
        + Add track
      </Button>
    </div>
  );
}
