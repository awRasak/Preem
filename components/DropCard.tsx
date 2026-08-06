import Link from "next/link";
import Image from "next/image";
import type { Drop } from "@/lib/types";
import { formatNaira, formatTimeLeft, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { Badge } from "./Badge";
import { Avatar } from "./Avatar";

export function DropCard({ drop }: { drop: Drop }) {
  const live = isDropLive(drop.window_end);

  return (
    <Link
      href={`/drop/${drop.id}`}
      className="block rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line-strong"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-surface-2">
        <Image
          src={drop.artwork_path || artworkFallback(drop.id)}
          alt={drop.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, 25vw"
        />
      </div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
        <Avatar
          src={drop.artist?.avatar_url ?? null}
          seed={drop.artist?.id ?? drop.artist_id}
          alt={drop.artist?.stage_name ?? ""}
          size={16}
        />
        {drop.artist?.stage_name ?? "Unknown artist"}
      </div>
      <div className="mb-2 truncate text-[15px] font-medium">{drop.title}</div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-accent">
          {formatNaira(drop.price_kobo)}
        </span>
        {drop.is_exclusive ? (
          <Badge status="exclusive">EXCLUSIVE</Badge>
        ) : live ? (
          <Badge status="live">LIVE</Badge>
        ) : (
          <Badge status="closed">Closed</Badge>
        )}
      </div>
      {live && drop.window_end && (
        <div className="mt-1 font-mono text-[11px] text-muted">
          {formatTimeLeft(drop.window_end)}
        </div>
      )}
    </Link>
  );
}
