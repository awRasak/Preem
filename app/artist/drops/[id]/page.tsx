import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { Badge } from "@/components/Badge";
import { DistributionGuidance } from "@/components/DistributionGuidance";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { OwnerControls } from "./OwnerControls";
import { LyricsSection } from "@/app/drop/[id]/LyricsSection";
import type { DropTrack } from "@/lib/types";

export default async function ArtistDropDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: drop } = await supabase
    .from("drops")
    .select("*, artist:artists(stage_name)")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();

  if (!drop) notFound();

  const artistName = Array.isArray(drop.artist)
    ? drop.artist[0]?.stage_name
    : drop.artist?.stage_name;

  const { data: tracksData } = await supabase
    .from("drop_tracks")
    .select("*")
    .eq("drop_id", id)
    .order("track_number", { ascending: true });
  const tracks = (tracksData ?? []) as DropTrack[];

  const { data: buyers } = await supabase
    .from("purchases")
    .select("fan_name, fan_phone, amount_kobo, purchased_at, track_id")
    .eq("drop_id", id)
    .eq("status", "success")
    .order("purchased_at", { ascending: false });

  const live = isDropLive(drop.window_end);
  const isBundle = drop.release_type !== "single" && tracks.length > 1;
  const trackTitleById = new Map(tracks.map((t) => [t.id, t.title]));

  return (
    <>
      <Nav role="artist">
        <NavLink href="/artist/dashboard">← Dashboard</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8">
        <div className="mb-4 flex items-start gap-4">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-surface-2">
            <Image
              src={drop.artwork_path || artworkFallback(drop.id)}
              alt={drop.title}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{drop.title}</h1>
              {drop.status === "draft" ? (
                <Badge status="pending">Draft</Badge>
              ) : drop.is_exclusive ? (
                <Badge status="exclusive">Exclusive</Badge>
              ) : live ? (
                <Badge status="live">Live</Badge>
              ) : (
                <Badge status="closed">Released</Badge>
              )}
            </div>
            <div className="mb-3 flex items-center gap-2">
              <Badge status="price">Min. Price {formatNaira(drop.min_price_kobo)}</Badge>
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {drop.release_type} · {tracks.length} track{tracks.length === 1 ? "" : "s"}
              </span>
            </div>
            {!isBundle && tracks[0] && (
              <OwnerControls
                trackId={tracks[0].id}
                title={tracks[0].title}
                artistName={artistName ?? ""}
                artworkUrl={drop.artwork_path}
              />
            )}
          </div>
        </div>

        {drop.description && (
          <p className="mb-4 text-sm text-muted">{drop.description}</p>
        )}
        {!isBundle && tracks[0]?.collaborators && (
          <p className="mb-2 text-xs text-muted">{tracks[0].collaborators}</p>
        )}
        {!isBundle && tracks[0]?.lyrics && <LyricsSection lyrics={tracks[0].lyrics} />}

        {isBundle && (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-bold">Tracks</h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {tracks.map((track) => (
                <div key={track.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {track.track_number}. {track.title}
                      </div>
                      {track.collaborators && (
                        <div className="mt-0.5 text-xs text-muted">{track.collaborators}</div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <Badge status="price">Min. {formatNaira(track.min_price_kobo)}</Badge>
                      <OwnerControls
                        trackId={track.id}
                        title={track.title}
                        artistName={artistName ?? ""}
                        artworkUrl={drop.artwork_path}
                      />
                    </div>
                  </div>
                  {track.lyrics && <LyricsSection lyrics={track.lyrics} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {!live && (
          <div className="mb-8">
            <DistributionGuidance />
          </div>
        )}

        <h2 className="mb-3 text-lg font-bold">Buyers ({buyers?.length ?? 0})</h2>
        <div className="divide-y divide-line rounded-xl border border-line">
          {(buyers ?? []).length === 0 && (
            <p className="p-5 text-sm text-muted">No sales yet.</p>
          )}
          {buyers?.map((b, i) => (
            <div key={i} className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="font-medium">{b.fan_name}</div>
                <div className="text-xs text-muted">
                  {b.fan_phone}
                  {isBundle && (
                    <>
                      {" · "}
                      {b.track_id ? (trackTitleById.get(b.track_id) ?? "Deleted track") : "Full release"}
                    </>
                  )}
                </div>
              </div>
              <span className="font-mono text-accent">
                {formatNaira(b.amount_kobo)}
              </span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
