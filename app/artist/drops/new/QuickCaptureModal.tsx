"use client";

/* eslint-disable @next/next/no-img-element -- blob: object URLs for local
   file previews aren't covered by next/image's remotePatterns */

import { Button } from "@/components/Button";
import type { WizardState } from "./types";

export function QuickCaptureModal({
  state,
  onChange,
  onDiscard,
  onContinue,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onDiscard: () => void;
  onContinue: () => void;
}) {
  function handleArtwork(file: File | null) {
    if (state.artworkPreviewUrl) URL.revokeObjectURL(state.artworkPreviewUrl);
    onChange({
      artworkFile: file,
      artworkPreviewUrl: file ? URL.createObjectURL(file) : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-6">
        <h2 className="mb-4 text-lg font-bold">New drop</h2>
        <label className="relative mb-4 block aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-surface-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="absolute inset-0 z-10 cursor-pointer opacity-0"
            onChange={(e) => handleArtwork(e.target.files?.[0] ?? null)}
          />
          {state.artworkPreviewUrl ? (
            <img
              src={state.artworkPreviewUrl}
              alt="Artwork preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <span className="text-2xl">+</span>
              <span className="text-xs font-bold text-muted">Add artwork</span>
            </div>
          )}
          <input
            type="text"
            value={state.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Title"
            className="absolute inset-x-0 bottom-0 z-10 bg-black/60 px-3 py-2.5 text-base font-bold text-white placeholder:text-white/60 focus:outline-none"
          />
        </label>
        <p className="mb-6 text-center text-[11px] text-muted">
          3000×3000px · PNG, JPG, or WEBP
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onDiscard}>
            Discard
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!state.title.trim()}
            onClick={onContinue}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
