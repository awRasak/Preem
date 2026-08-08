import type { ReactNode } from "react";

export function JaggedBanner({
  eyebrow,
  title,
  copy,
  action,
  secondaryAction,
}: {
  eyebrow?: string;
  title: string;
  copy: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col-reverse items-center justify-between gap-8 overflow-hidden rounded-[20px] border border-line bg-surface p-8 sm:flex-row sm:p-11">
      <div className="text-center sm:text-left">
        {eyebrow && (
          <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent sm:justify-start">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {eyebrow}
          </div>
        )}
        <h3 className="max-w-[280px] text-2xl font-bold leading-tight sm:text-[26px]">
          {title}
        </h3>
        <p className="mx-auto mt-3 max-w-[280px] text-[13.5px] text-muted sm:mx-0">
          {copy}
        </p>
        {(action || secondaryAction) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
      <div className="jag-shape h-[130px] w-[130px] flex-shrink-0 sm:h-[170px] sm:w-[170px]" />
    </div>
  );
}
