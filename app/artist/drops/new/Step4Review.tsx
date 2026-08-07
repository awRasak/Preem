"use client";

import { Badge } from "@/components/Badge";
import { formatNaira } from "@/lib/format";
import { PreviewCard } from "./PreviewCard";
import type { WizardState } from "./types";

export function Step4Review({ state }: { state: WizardState }) {
  const tracks = state.releaseType === "single"
    ? state.singleAudioFile
      ? [{ title: state.title, minPriceNaira: state.minPriceNaira }]
      : []
    : state.tracks;

  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        This is what fans will see on the drop page.
      </p>
      <div className="mb-6 max-w-xs">
        <PreviewCard state={state} />
      </div>

      {state.releaseType !== "single" && (
        <div className="mb-4 divide-y divide-line rounded-xl border border-line">
          {tracks.map((t, i) => (
            <div key={i} className="flex items-center justify-between p-3 text-sm">
              <span>{i + 1}. {t.title || "Untitled track"}</span>
              <Badge status="price">
                Min. {formatNaira(Math.round((Number(t.minPriceNaira) || 0) * 100))}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{state.dropType === "exclusive" ? "Exclusive — no expiry" : `Early access — ${state.windowHours}h window`}</span>
      </div>
    </div>
  );
}
