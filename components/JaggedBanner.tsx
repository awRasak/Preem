import type { ReactNode } from "react";

export function JaggedBanner({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col-reverse items-center justify-between gap-8 overflow-hidden rounded-[20px] border border-line bg-surface p-8 sm:flex-row sm:p-11">
      <div className="text-center sm:text-left">
        <h3 className="max-w-[280px] text-2xl font-bold leading-tight sm:text-[26px]">
          {title}
        </h3>
        <p className="mx-auto mt-3 max-w-[280px] text-[13.5px] text-muted sm:mx-0">
          {copy}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
      <div className="jag-shape h-[130px] w-[130px] flex-shrink-0 sm:h-[170px] sm:w-[170px]" />
    </div>
  );
}
