"use client";

import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";

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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-1 sm:gap-2">
        <div className="flex min-w-0 items-center gap-0.5 sm:gap-2">
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
            className="whitespace-nowrap rounded-full px-2 py-2 text-xs font-bold text-muted underline hover:text-paper sm:px-3"
          >
            Save and Close
          </button>
          <button
            type="button"
            onClick={onPreview}
            className="whitespace-nowrap rounded-full px-2 py-2 text-xs font-bold text-muted underline hover:text-paper sm:px-3"
          >
            Preview
          </button>
        </div>
        <Button
          type="button"
          variant="primary"
          className="!px-4 !py-2.5 text-sm whitespace-nowrap shrink-0 sm:!px-6"
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {primaryLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" tone="current" />
            </span>
          ) : (
            primaryLabel
          )}
        </Button>
      </div>
    </div>
  );
}
