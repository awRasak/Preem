import Image from "next/image";
import Link from "next/link";
import { formatNaira, formatShowDate } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { showPath } from "@/lib/slug";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { BuyTicketButton } from "./ShowTicketModal";

export type ShowCardShow = {
  id: string;
  slug?: string | null;
  title: string;
  venue: string | null;
  city: string | null;
  start_at: string;
  sales_close_at?: string | null;
  ticket_price_kobo: number;
  total_tickets: number;
  cover_art_path: string | null;
  soldCount: number;
  artist?: { id: string; stage_name: string; avatar_url: string | null };
  artist_name?: string;
  tiers?: { id: string; name: string; price_kobo: number; quantity: number; design: string }[];
};

export function ShowCard({
  show,
  showArtist = false,
}: {
  show: ShowCardShow;
  showArtist?: boolean;
}) {
  const soldOut = show.soldCount >= show.total_tickets;
  const salesCloseAt = new Date(show.sales_close_at ?? show.start_at).getTime();
  // eslint-disable-next-line react-hooks/purity -- evaluated once at render; sales state is revalidated on navigation/refresh.
  const salesClosed = salesCloseAt <= Date.now();
  const artistName = show.artist?.stage_name ?? show.artist_name ?? "";
  const href = showPath(show.slug || show.id);

  return (
    <div className="card-inset-glow rounded-xl border border-line bg-card p-3 transition-all duration-200 ease-out">
      <Link href={href} className="block">
        <div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-surface-2">
          <Image
            src={show.cover_art_path || artworkFallback(show.id)}
            alt={show.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
          <div className="absolute right-2 top-2">
            {soldOut ? (
              <Badge status="closed">Sold out</Badge>
            ) : salesClosed ? (
              <Badge status="closed">Sales closed</Badge>
            ) : (
              <Badge status="live">On sale</Badge>
            )}
          </div>
        </div>
        {showArtist && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            <Avatar
              src={show.artist?.avatar_url ?? null}
              seed={show.artist?.id ?? show.id}
              alt={artistName}
              size={16}
            />
            {artistName}
          </div>
        )}
        <div className="truncate text-[15px] font-medium">{show.title}</div>
        <div className="mt-1 font-mono text-[11px] text-muted">
          {formatShowDate(show.start_at)}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted">
          {[show.venue, show.city].filter(Boolean).join(" · ") || "TBA"}
        </div>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold">
            {show.tiers && show.tiers.length > 0
              ? `From ${formatNaira(Math.min(...show.tiers.map((t) => t.price_kobo)))}`
              : formatNaira(show.ticket_price_kobo)}
          </div>
          <div className="text-[11px] text-muted">
            {Math.max(0, show.total_tickets - show.soldCount)} left
          </div>
        </div>
        {soldOut ? (
          <Badge status="closed">Sold out</Badge>
        ) : salesClosed ? (
          <Badge status="closed">Closed</Badge>
        ) : (
          <BuyTicketButton
            show={{
              id: show.id,
              title: show.title,
              venue: show.venue,
              city: show.city,
              start_at: show.start_at,
              sales_close_at: show.sales_close_at ?? null,
              ticket_price_kobo: show.ticket_price_kobo,
            }}
            artistName={artistName}
            tiers={show.tiers?.map((t) => ({
              id: t.id,
              name: t.name,
              price_kobo: t.price_kobo,
              quantity: t.quantity,
              design: t.design,
              soldCount: 0,
            }))}
          />
        )}
      </div>
    </div>
  );
}