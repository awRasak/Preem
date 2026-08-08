"use client";

/* eslint-disable @next/next/no-img-element -- blob: object URLs for local
   file previews aren't covered by next/image's remotePatterns */

import { Badge } from "@/components/Badge";
import { formatNaira } from "@/lib/format";
import type { WizardState } from "./types";

export function PreviewCard({ state }: { state: WizardState }) {
  const trackCount =
    state.releaseType === "single" ? 1 : Math.max(state.tracks.length, 0);
  const minPriceKobo = Math.round((Number(state.minPriceNaira) || 0) * 100);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
        {state.artworkPreviewUrl ? (
          <img
            src={state.artworkPreviewUrl}
            alt="Artwork preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            No artwork yet
          </div>
        )}
      </div>
      <div className="mb-1 truncate text-base font-bold">
        {state.title || "Untitled drop"}
      </div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
        {state.releaseType} · {trackCount} track{trackCount === 1 ? "" : "s"}
      </div>
      {state.description && (
        <p className="mb-3 line-clamp-2 text-xs text-muted">{state.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {minPriceKobo > 0 && (
          <Badge status="price">Min. Price {formatNaira(minPriceKobo)}</Badge>
        )}
        {state.dropType === "exclusive" ? (
          <Badge status="exclusive">EXCLUSIVE</Badge>
        ) : (
          <span className="text-[11px] text-muted">Public {state.releaseDate}</span>
        )}
      </div>
    </div>
  );
}
