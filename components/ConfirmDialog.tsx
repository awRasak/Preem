"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  tone = "danger",
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  tone?: "danger" | "primary";
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = original;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (!cardRef.current?.contains(e.target as Node)) onCancel();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-6 text-left"
      >
        <h2 className="mb-2 text-lg font-bold">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted">{description}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
            autoFocus
          >
            {cancelLabel}
          </Button>
          {tone === "danger" ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#ff6b6b] px-6 py-3 text-sm font-bold text-[#2a0a0a] transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.03] active:scale-95 active:opacity-100 disabled:pointer-events-none disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="xs" tone="current" />
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          ) : (
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="xs" tone="current" />
                </span>
              ) : (
                confirmLabel
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
