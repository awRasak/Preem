import Link from "next/link";
import Image from "next/image";
import type { Drop } from "@/lib/types";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { Badge } from "./Badge";
import { Avatar } from "./Avatar";
import { TimeLeft } from "./TimeLeft";

export function DropCard({ drop }: { drop: Drop }) {
  const live = isDropLive(drop.window_end);

  return (
    <Link
      href={`/drop/${drop.id}`}
      className="card-inset-glow block rounded-xl border border-line bg-card p-3 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-line-strong hover:shadow-xl hover:shadow-black/40"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-surface-2">
        <Image
          src={drop.artwork_path || artworkFallback(drop.id)}
          alt={drop.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, 25vw"
        />
        <div className="absolute right-2 top-2">
          {drop.is_exclusive ? (
            <Badge status="exclusive">EXCLUSIVE</Badge>
          ) : live ? (
            <Badge status="live">LIVE</Badge>
          ) : (
            <Badge status="closed">Closed</Badge>
          )}
        </div>
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
      <div className="flex items-center justify-between gap-2">
        <Badge status="price">Min. {formatNaira(drop.min_price_kobo)}</Badge>
        {live && drop.window_end && (
          <div className="flex-shrink-0 font-mono text-[11px] text-muted">
            <TimeLeft windowEnd={drop.window_end} />
          </div>
        )}
      </div>
    </Link>
  );
}
