"use client";

/* eslint-disable @next/next/no-img-element -- blob: object URLs for local
   file previews aren't covered by next/image's remotePatterns */

import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { prepareArtworkFile } from "@/lib/client-image";
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
  async function handleArtwork(file: File | null) {
    if (state.artworkPreviewUrl) URL.revokeObjectURL(state.artworkPreviewUrl);
    const prepared = file ? await prepareArtworkFile(file) : null;
    onChange({
      artworkFile: prepared,
      artworkPreviewUrl: prepared ? URL.createObjectURL(prepared) : null,
    });
  }

  return (
    // Mobile: a plain full-screen step, no dark backdrop or floating card
    // chrome. Desktop (sm+): the modal-over-backdrop treatment.
    <div className="fixed inset-0 z-50 flex flex-col bg-bg px-5 py-6 sm:items-center sm:justify-center sm:bg-black/70 sm:p-4 sm:backdrop-blur-sm">
      <div className="flex flex-1 flex-col sm:flex-none sm:w-full sm:max-w-sm sm:rounded-xl sm:border sm:border-line-strong sm:bg-surface sm:p-6">
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
        </label>
        <Field label="Title">
          <Input
            value={state.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Name your drop"
            maxLength={120}
          />
        </Field>
        <p className="mb-6 text-center text-[11px] text-muted">
          3000×3000px · PNG, JPG, or WEBP
        </p>
        <div className="mt-auto flex gap-2 sm:mt-0">
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
