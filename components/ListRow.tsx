import Image from "next/image";
import type { ReactNode } from "react";

export function ListRow({
  artworkUrl,
  title,
  meta,
  right,
}: {
  artworkUrl?: string | null;
  title: string;
  meta: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-line py-3 last:border-none">
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
        {artworkUrl && (
          <Image src={artworkUrl} alt={title} fill className="object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted">{meta}</div>
      </div>
      {right}
    </div>
  );
}
