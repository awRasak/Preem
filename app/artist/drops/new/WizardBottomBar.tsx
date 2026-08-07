"use client";

import { Button } from "@/components/Button";

export function WizardBottomBar({
  onBack,
  onSaveAndClose,
  onPreview,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
}: {
  onBack?: () => void;
  onSaveAndClose: () => void;
  onPreview: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button type="button" variant="outline" className="!px-4 !py-2 text-xs" onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onSaveAndClose}
            className="rounded-full px-3 py-2 text-xs font-bold text-muted underline hover:text-paper"
          >
            Save and Close
          </button>
          <button
            type="button"
            onClick={onPreview}
            className="rounded-full px-3 py-2 text-xs font-bold text-muted underline hover:text-paper"
          >
            Preview
          </button>
        </div>
        <Button
          type="button"
          variant="primary"
          className="!px-6 !py-2.5 text-sm"
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {primaryLoading ? "…" : primaryLabel}
        </Button>
      </div>
    </div>
  );
}
