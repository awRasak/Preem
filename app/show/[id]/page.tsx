import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Nav, NavLink } from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { BuyTicketButton } from "@/components/ShowTicketModal";
import { formatNaira, formatShowDate } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { artistPath, isUuid, showPath } from "@/lib/slug";

export const revalidate = 0;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://preem.ng";

type ShowRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  start_at: string;
  sales_close_at: string | null;
  ticket_price_kobo: number;
  total_tickets: number;
  cover_art_path: string | null;
  status: string;
  artist:
    | { id: string; stage_name: string; avatar_url: string | null; approval_status?: string }
    | { id: string; stage_name: string; avatar_url: string | null; approval_status?: string }[]
    | null;
  tiers?: { id: string; name: string; price_kobo: number; quantity: number; design: string; sort_order: number; soldCount?: number }[];
};

type Resolved = {
  show: ShowRow;
  artist: { id: string; stage_name: string; avatar_url: string | null };
  soldCount: number;
};

async function resolveShow(idOrSlug: string): Promise<Resolved | null> {
  const supabase = await createClient();
  const base = supabase
    .from("shows")
    .select(
      "*, artist:artists!drops_artist_id_fkey(id, stage_name, avatar_url, approval_status), tiers:show_ticket_tiers(id, name, price_kobo, quantity, design, sort_order)",
    )
    .eq("status", "published");

  let show: ShowRow | null = null;
  if (isUuid(idOrSlug)) {
    const { data } = await base.eq("id", idOrSlug).maybeSingle();
    show = (data as ShowRow | null) ?? null;
  } else {
    const { data } = await base
      .eq("slug", idOrSlug)
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    show = (data as ShowRow | null) ?? null;
  }

  const rawArtist = show?.artist ?? null;
  const artist = Array.isArray(rawArtist) ? rawArtist[0] : rawArtist;

  if (!show || !artist || artist.approval_status !== "approved") return null;

  const admin = createAdminClient();
  const { data: soldTickets } = await admin
    .from("show_tickets")
    .select("tier_id")
    .eq("show_id", show.id)
    .eq("status", "success");

  const soldByTier = new Map<string | null, number>();
  for (const t of soldTickets ?? []) {
    const key = t.tier_id ?? null;
    soldByTier.set(key, (soldByTier.get(key) ?? 0) + 1);
  }
  const totalSold = soldTickets?.length ?? 0;

  // Attach sold counts to tiers.
  const tiers = (show.tiers ?? []).map((t) => ({
    ...t,
    soldCount: soldByTier.get(t.id) ?? 0,
  }));

  return { show: { ...show, tiers }, artist, soldCount: totalSold };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolved = await resolveShow(id);
  if (!resolved) return {};
  const { show, artist } = resolved;
  const title = `${show.title}${artist ? ` — ${artist.stage_name}` : ""} | Preem`;
  const when = formatShowDate(show.start_at);
  const where = [show.venue, show.city].filter(Boolean).join(", ") || "TBA";
  const description = `Live show: ${when}${where ? ` · ${where}` : ""}. Tickets from ${formatNaira(show.ticket_price_kobo)} on Preem.`;
  const canonical = `${APP_URL}${showPath(show.slug || show.id)}`;
  const image = show.cover_art_path || `${APP_URL}/og-default.png`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resolved = await resolveShow(id);
  if (!resolved) notFound();
  const { show, artist, soldCount } = resolved;

  const tiers = (show.tiers ?? []) as NonNullable<ShowRow["tiers"]>;
  const hasTiers = tiers.length > 0;
  const totalCapacity = hasTiers
    ? tiers.reduce((s, t) => s + t.quantity, 0)
    : show.total_tickets;
  const soldOut = soldCount >= totalCapacity;
  const salesCloseAt = new Date(show.sales_close_at ?? show.start_at).getTime();
  // eslint-disable-next-line react-hooks/purity -- server-render time determines sales-open state for this request.
  const salesClosed = salesCloseAt <= Date.now();
  const left = Math.max(0, totalCapacity - soldCount);

  return (
    <>
      <Nav>
        <NavLink href="/explore">← Explore</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-start">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface-2 sm:aspect-[4/3]">
            <Image
              src={show.cover_art_path || artworkFallback(show.id)}
              alt={show.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 320px"
              priority
            />
          </div>
          <div>
            {artist && (
              <Link
                href={artistPath(artist.stage_name)}
                className="mb-3 inline-flex items-center gap-2 text-sm text-muted hover:text-paper"
              >
                <Avatar src={artist.avatar_url} seed={artist.id} alt={artist.stage_name} size={24} />
                {artist.stage_name}
              </Link>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{show.title}</h1>
              {soldOut ? (
                <Badge status="closed">Sold out</Badge>
              ) : salesClosed ? (
                <Badge status="closed">Sales closed</Badge>
              ) : (
                <Badge status="live">On sale</Badge>
              )}
            </div>
            <div className="mb-1 font-mono text-sm text-muted">{formatShowDate(show.start_at)}</div>
            <div className="mb-4 text-sm text-muted">
              {[show.venue, show.city].filter(Boolean).join(" · ") || "Venue TBA"}
            </div>
            {show.description && (
              <p className="mb-5 whitespace-pre-wrap text-sm text-paper/90">{show.description}</p>
            )}

            <div className="mb-5 rounded-xl border border-line bg-surface p-4">
              {hasTiers ? (
                <div className="space-y-2">
                  {tiers
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((t) => {
                      const tierSold = t.soldCount ?? 0;
                      const tierLeft = Math.max(0, t.quantity - tierSold);
                      const tierSoldOut = tierSold >= t.quantity;
                      return (
                        <div key={t.id} className="flex items-center justify-between">
                          <div>
                            <span className="font-bold">{t.name}</span>
                            <span className="ml-2 text-xs text-muted capitalize">{t.design}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{formatNaira(t.price_kobo)}</div>
                            <div className="text-[11px] text-muted">
                              {tierSoldOut ? "Sold out" : `${tierLeft} left`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <>
                  <div className="mb-1 text-2xl font-bold">{formatNaira(show.ticket_price_kobo)}</div>
                  <div className="text-sm text-muted">
                    {soldOut ? "No tickets left" : salesClosed ? "Ticket sales are closed" : `${left} of ${show.total_tickets} tickets left`}
                  </div>
                </>
              )}
              {!hasTiers && (
                <div className="text-sm text-muted">
                  {soldOut ? "No tickets left" : salesClosed ? "Ticket sales are closed" : `${left} of ${totalCapacity} tickets left`}
                </div>
              )}
              {show.sales_close_at && !salesClosed && (
                <div className="mt-2 text-xs text-muted">
                  Sales close {formatShowDate(show.sales_close_at)}
                </div>
              )}
            </div>

            {!soldOut && !salesClosed ? (
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
                artistName={artist?.stage_name ?? ""}
                tiers={tiers.map((t) => ({
                  id: t.id,
                  name: t.name,
                  price_kobo: t.price_kobo,
                  quantity: t.quantity,
                  design: t.design,
                  soldCount: t.soldCount ?? 0,
                }))}
              />
            ) : (
              <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
                {soldOut ? "This show is sold out." : "Ticket sales for this show have closed."}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
