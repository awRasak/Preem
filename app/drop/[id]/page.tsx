import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { CountdownBadge } from "./CountdownBadge";
import { BuyButton } from "./BuyButton";
import { LyricsSection } from "./LyricsSection";
import { DiscoverMore } from "@/components/DiscoverMore";
import type { ArtistLink, Drop } from "@/lib/types";

export const revalidate = 0;

export default async function DropPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("drops")
    .select("*, artist:artists(id, stage_name, avatar_url, approval_status)")
    .eq("id", id)
    .single();

  const drop = data as
    | (Drop & {
        artist: {
          id: string;
          stage_name: string;
          avatar_url: string | null;
          approval_status: string;
        } | null;
      })
    | null;

  if (!drop || drop.artist?.approval_status !== "approved") notFound();

  const live = isDropLive(drop.window_end);

  const { data: links } = await supabase
    .from("artist_links")
    .select("*")
    .eq("artist_id", drop.artist_id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Nav>
        <NavLink href="/">← Back</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="relative aspect-square w-full flex-shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-[240px]">
            <Image
              src={drop.artwork_path || artworkFallback(drop.id)}
              alt={drop.title}
              fill
              className="object-cover"
              sizes="240px"
            />
          </div>
          <div className="flex-1">
            <Link
              href={`/artist/${drop.artist?.id}`}
              className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted hover:text-paper"
            >
              <Avatar
                src={drop.artist?.avatar_url ?? null}
                seed={drop.artist?.id ?? drop.artist_id}
                alt={drop.artist?.stage_name ?? ""}
                size={24}
              />
              {drop.artist?.stage_name}
            </Link>
            <h1 className="mb-3 text-2xl font-bold sm:text-3xl">{drop.title}</h1>
            {drop.is_exclusive ? (
              <Badge status="exclusive">EXCLUSIVE</Badge>
            ) : live && drop.window_end ? (
              <CountdownBadge windowEnd={drop.window_end} />
            ) : (
              <Badge status="closed">Released</Badge>
            )}
            {drop.description && (
              <p className="mt-4 text-sm text-muted">{drop.description}</p>
            )}
            {drop.lyrics && <LyricsSection lyrics={drop.lyrics} />}
            <div className="mt-6 flex items-center gap-4">
              <span className="font-mono text-lg text-accent">
                {formatNaira(drop.price_kobo)}
              </span>
              {live ? (
                <BuyButton
                  dropId={drop.id}
                  priceKobo={drop.price_kobo}
                  title={drop.title}
                  isExclusive={drop.is_exclusive}
                />
              ) : (
                <p className="text-xs text-muted">
                  Early access has closed. Buyers keep permanent access in My Drops.
                </p>
              )}
            </div>
            <p className="mt-4 text-[11px] text-muted">
              No refunds once access is granted.
            </p>
          </div>
        </div>

        <DiscoverMore
          artistName={drop.artist?.stage_name ?? ""}
          links={(links ?? []) as ArtistLink[]}
        />
      </main>
    </>
  );
}
