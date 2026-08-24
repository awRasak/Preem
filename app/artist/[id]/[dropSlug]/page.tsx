import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/slug";
import { dropShareMetadata } from "@/lib/seo";
import DropView from "@/app/drop/[id]/DropView";

export const revalidate = 0;

async function resolveIds(artistSlug: string, dropSlug: string) {
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

  return drop ? { artistId: artist.id, dropId: drop.id } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; dropSlug: string }>;
}): Promise<Metadata> {
  const { id: artistSlug, dropSlug } = await params;
  const resolved = await resolveIds(artistSlug, dropSlug);
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
  });
}

// /artist/<artist-slug>/<release-slug> -- the human-readable drop URL. Both
// segments also accept raw uuids so old links and freshly-renamed artists
// keep resolving.
export default async function ArtistDropPage({
  params,
}: {
  params: Promise<{ id: string; dropSlug: string }>;
}) {
  const { id: artistSlug, dropSlug } = await params;
  const resolved = await resolveIds(artistSlug, dropSlug);
  if (!resolved) notFound();

  return <DropView dropId={resolved.dropId} />;
}
