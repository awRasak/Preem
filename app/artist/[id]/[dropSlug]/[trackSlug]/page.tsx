import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/slug";
import { dropShareMetadata } from "@/lib/seo";
import DropView from "@/app/drop/[id]/DropView";

export const revalidate = 0;

async function resolveTrack(artistSlug: string, dropSlug: string, trackSlug: string) {
  const supabase = await createClient();

  const base = supabase.from("artists").select("id").eq("approval_status", "approved");
  const { data: artist } = isUuid(artistSlug)
    ? await base.eq("id", artistSlug).maybeSingle()
    : await base
        .eq("slug", artistSlug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
  if (!artist) return null;

  const dropBase = supabase.from("drops").select("id").eq("status", "published");
  const { data: drop } = isUuid(dropSlug)
    ? await dropBase.eq("id", dropSlug).eq("artist_id", artist.id).maybeSingle()
    : await dropBase
        .eq("slug", dropSlug)
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
  if (!drop) return null;

  let trackId: string | undefined;
  let trackTitle: string | undefined;
  const trackQuery = supabase
    .from("drop_tracks")
    .select("id, title")
    .eq("drop_id", drop.id);
  if (isUuid(trackSlug)) {
    const { data: t } = await trackQuery.eq("id", trackSlug).maybeSingle();
    trackId = t?.id;
    trackTitle = t?.title;
  } else {
    const { data: t } = await trackQuery
      .eq("slug", trackSlug)
      .order("track_number", { ascending: true })
      .limit(1)
      .maybeSingle();
    trackId = t?.id;
    trackTitle = t?.title;
  }
  if (!trackId) return null;

  return { dropId: drop.id, trackId, trackTitle };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; dropSlug: string; trackSlug: string }>;
}): Promise<Metadata> {
  const { id: artistSlug, dropSlug, trackSlug } = await params;
  const resolved = await resolveTrack(artistSlug, dropSlug, trackSlug);
  if (!resolved) return {};

  const supabase = await createClient();
  const { data: drop } = await supabase
    .from("drops")
    .select("title, description, artwork_path, artist:artists(stage_name)")
    .eq("id", resolved.dropId)
    .maybeSingle();
  const artist = drop?.artist as { stage_name: string } | null | undefined;
  if (!drop || !artist) return {};

  return dropShareMetadata({
    title: drop.title,
    artistName: artist.stage_name,
    description: drop.description,
    artworkPath: drop.artwork_path,
    trackTitle: resolved.trackTitle,
  });
}

export default async function ArtistDropTrackPage({
  params,
}: {
  params: Promise<{ id: string; dropSlug: string; trackSlug: string }>;
}) {
  const { id: artistSlug, dropSlug, trackSlug } = await params;
  const resolved = await resolveTrack(artistSlug, dropSlug, trackSlug);
  if (!resolved) notFound();

  return <DropView dropId={resolved.dropId} initialTrackId={resolved.trackId} />;
}
