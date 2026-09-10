"use client";

// Shared waiting states, matching existing UI tokens: the spinner ring uses
// the accent brand color; the progress bar copies the drop-wizard upload
// pattern (surface-2 track, paper fill, pulsing indeterminate fill).

export function Spinner({
  size = "sm",
  tone = "accent",
  label,
}: {
  size?: "xs" | "sm" | "md";
  tone?: "accent" | "current";
  label?: string;
}) {
  const dims =
    size === "xs" ? "h-3.5 w-3.5" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      className={`inline-block animate-spin rounded-full border-2 border-line-strong ${dims} ${
        tone === "accent" ? "border-t-accent" : "border-t-current"
      }`}
    />
  );
}

export function ProgressBar({
  label,
  percent,
}: {
  label: string;
  // null = indeterminate (unknown length, e.g. server round-trip).
  percent: number | null;
}) {
  return (
    <div className="mt-4" aria-live="polite">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
        {percent !== null ? ` · ${percent}%` : "…"}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        {percent !== null ? (
          <div
            className="h-full rounded-full bg-paper transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded-full bg-paper/40" />
        )}
      </div>
    </div>
  );
}
