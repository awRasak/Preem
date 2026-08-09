import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { DropCard } from "@/components/DropCard";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { CountdownBadge } from "./CountdownBadge";
import { BuyButton } from "./BuyButton";
import { LyricsSection } from "./LyricsSection";
import { PreviewButton } from "@/components/PreviewButton";
import { DiscoverMore } from "@/components/DiscoverMore";
import { genreLabel } from "@/lib/genres";
import type { PlayerTrack } from "@/lib/player-context";
import type { ArtistLink, Drop, DropTrack } from "@/lib/types";

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
    .select(
      "*, artist:artists(id, stage_name, avatar_url, approval_status, thank_you_text, thank_you_media_url, thank_you_media_type)",
    )
    .eq("id", id)
    .eq("status", "published")
    .single();

  const drop = data as
    | (Drop & {
        artist: {
          id: string;
          stage_name: string;
          avatar_url: string | null;
          approval_status: string;
          thank_you_text: string | null;
          thank_you_media_url: string | null;
          thank_you_media_type: "image" | "video" | null;
        } | null;
      })
    | null;

  if (!drop || drop.artist?.approval_status !== "approved") notFound();

  const live = isDropLive(drop.window_end);
  const artistId = drop.artist?.id ?? drop.artist_id;
  const artistName = drop.artist?.stage_name ?? "";

  const { data: tracksData } = await supabase
    .from("drop_tracks")
    .select("*")
    .eq("drop_id", drop.id)
    .order("track_number", { ascending: true });
  const tracks = (tracksData ?? []) as DropTrack[];
  const isBundle = drop.release_type !== "single" && tracks.length > 1;
  const previewQueue: PlayerTrack[] = tracks.map((t) => ({
    trackId: t.id,
    title: t.title,
    artistName,
    artworkUrl: drop.artwork_path,
    preview: { dropId: drop.id, trackId: t.id },
  }));

  const { data: links } = await supabase
    .from("artist_links")
    .select("*")
    .eq("artist_id", drop.artist_id)
    .order("created_at", { ascending: false });

  const { data: moreData } = await supabase
    .from("drops")
    .select("*, artist:artists(id, stage_name, avatar_url, approval_status)")
    .eq("artist_id", drop.artist_id)
    .eq("status", "published")
    .neq("id", drop.id)
    .or(`window_end.is.null,window_end.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(8);
  const moreFromArtist = (moreData ?? []) as (Drop & {
    artist: {
      id: string;
      stage_name: string;
      avatar_url: string | null;
      approval_status: string;
    } | null;
  })[];

  return (
    <>
      {/* Drop-link entry: artist identity leads, not the Preem wordmark */}
      <nav className="flex items-center justify-between border-b border-line px-5 py-3 sm:px-8">
        <Link href="/" className="text-xs font-bold text-muted hover:text-paper">
          ← Back
        </Link>
        <Link
          href={`/artist/${artistId}`}
          className="flex items-center gap-2 rounded-full border border-line-strong py-1 pl-1 pr-3"
        >
          <Avatar
            src={drop.artist?.avatar_url ?? null}
            seed={artistId}
            alt={artistName}
            size={26}
          />
          <span className="max-w-[140px] truncate text-sm font-medium">{artistName}</span>
        </Link>
      </nav>
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
            <h1 className="mb-3 text-2xl font-bold sm:text-3xl">{drop.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {drop.is_exclusive ? (
                <Badge status="exclusive">EXCLUSIVE</Badge>
              ) : live && drop.window_end ? (
                <CountdownBadge windowEnd={drop.window_end} />
              ) : (
                <Badge status="closed">Released</Badge>
              )}
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {genreLabel(drop.genre)}
                {drop.secondary_genre ? ` / ${genreLabel(drop.secondary_genre)}` : ""}
                {isBundle ? ` · ${drop.release_type} · ${tracks.length} tracks` : ""}
              </span>
            </div>
            {drop.description && (
              <p className="mt-4 text-sm text-muted">{drop.description}</p>
            )}
            {!isBundle && tracks[0]?.collaborators && (
              <p className="mt-3 text-xs text-muted">{tracks[0].collaborators}</p>
            )}
            {!isBundle && tracks[0]?.lyrics && (
              <LyricsSection lyrics={tracks[0].lyrics} />
            )}
            <div className="mt-6 flex items-center gap-4">
              <Badge status="price">Min. Price {formatNaira(drop.min_price_kobo)}</Badge>
              {!isBundle && tracks[0] && (
                <PreviewButton
                  dropId={drop.id}
                  trackId={tracks[0].id}
                  title={drop.title}
                  artistName={artistName}
                  artworkUrl={drop.artwork_path}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong text-sm"
                />
              )}
              {live ? (
                <BuyButton
                  dropId={drop.id}
                  trackId={!isBundle ? tracks[0]?.id : undefined}
                  minPriceKobo={drop.min_price_kobo}
                  title={drop.title}
                  isExclusive={drop.is_exclusive}
                  label={isBundle ? "Buy full release" : "Buy access"}
                  artistName={artistName}
                  thankYouText={drop.artist?.thank_you_text}
                  thankYouMediaUrl={drop.artist?.thank_you_media_url}
                  thankYouMediaType={drop.artist?.thank_you_media_type}
                />
              ) : (
                <p className="text-xs text-muted">
                  Early access has closed. Buyers keep permanent access in My Music Collections.
                </p>
              )}
            </div>
            <p className="mt-4 text-[11px] text-muted">
              You decide the price — every contribution supports the artist. No refunds once access is granted.
            </p>
          </div>
        </div>

        {isBundle && (
          <div className="mt-8">
            <h2 className="mb-3 text-lg font-bold">Tracklist</h2>
            <p className="mb-4 text-xs text-muted">
              Buying all tracks individually costs more in total than the full release —
              the release price above is the discount for buying everything at once.
            </p>
            <div className="divide-y divide-line rounded-xl border border-line">
              {tracks.map((track) => (
                <div key={track.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {track.track_number}. {track.title}
                    </div>
                    {track.collaborators && (
                      <div className="mt-0.5 text-xs text-muted">{track.collaborators}</div>
                    )}
                    {track.lyrics && <LyricsSection lyrics={track.lyrics} />}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <Badge status="price">Min. {formatNaira(track.min_price_kobo)}</Badge>
                    <PreviewButton
                      dropId={drop.id}
                      trackId={track.id}
                      title={track.title}
                      artistName={artistName}
                      artworkUrl={drop.artwork_path}
                      queue={previewQueue}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong text-xs"
                    />
                    {live && (
                      <BuyButton
                        dropId={drop.id}
                        trackId={track.id}
                        minPriceKobo={track.min_price_kobo}
                        title={track.title}
                        isExclusive={drop.is_exclusive}
                        label="Buy track"
                        artistName={artistName}
                        thankYouText={drop.artist?.thank_you_text}
                        thankYouMediaUrl={drop.artist?.thank_you_media_url}
                        thankYouMediaType={drop.artist?.thank_you_media_type}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {moreFromArtist.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-bold">More from {artistName}</h2>
            <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 pt-2 sm:-mx-8 sm:px-8">
              {moreFromArtist.map((d) => (
                <div key={d.id} className="w-[200px] flex-shrink-0 sm:w-[240px]">
                  <DropCard drop={d} />
                </div>
              ))}
            </div>
          </div>
        )}

        <DiscoverMore
          artistName={artistName}
          links={(links ?? []) as ArtistLink[]}
        />
      </main>
    </>
  );
}
