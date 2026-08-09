import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ArtistShell } from "@/components/ArtistShell";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { DeleteDropButton } from "../dashboard/DeleteDropButton";
import type { Drop } from "@/lib/types";

export default async function ArtistDropsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("stage_name, avatar_url")
    .eq("id", user.id)
    .single();
  if (!artist) redirect("/artist/login");

  const { data: drops } = await supabase
    .from("drops")
    .select("*")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });

  const dropIds = (drops ?? []).map((d) => d.id);
  const { data: tracks } = dropIds.length
    ? await supabase.from("drop_tracks").select("drop_id, audio_file_path").in("drop_id", dropIds)
    : { data: [] as { drop_id: string; audio_file_path: string }[] };

  const pathsByDrop = new Map<string, string[]>();
  for (const t of tracks ?? []) {
    const list = pathsByDrop.get(t.drop_id) ?? [];
    list.push(t.audio_file_path);
    pathsByDrop.set(t.drop_id, list);
  }

  return (
    <ArtistShell
      active="drops"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Drops</h1>
          <Button href="/artist/drops/new" variant="primary">
            + New drop
          </Button>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line">
          {(drops ?? []).length === 0 && (
            <p className="p-5 text-sm text-muted">
              No drops yet — publish your first one.
            </p>
          )}
          {(drops as Drop[] | null)?.map((drop) => {
            const live = drop.status === "published" && isDropLive(drop.window_end);
            return (
              <div key={drop.id} className="flex items-center justify-between gap-3 p-4">
                <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  <Image
                    src={drop.artwork_path || artworkFallback(drop.id)}
                    alt={drop.title}
                    fill
                    className="object-cover"
                    sizes="44px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={`/artist/drops/${drop.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {drop.title}
                  </a>
                  <div className="mt-1 text-xs text-muted">
                    {drop.release_type} · Min. {formatNaira(drop.min_price_kobo)}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {drop.status === "draft" ? (
                    <Badge status="pending">Draft</Badge>
                  ) : drop.is_exclusive ? (
                    <Badge status="exclusive">Exclusive</Badge>
                  ) : live ? (
                    <Badge status="live">Live</Badge>
                  ) : (
                    <Badge status="closed">Released</Badge>
                  )}
                  <DeleteDropButton dropId={drop.id} audioPaths={pathsByDrop.get(drop.id) ?? []} />
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </ArtistShell>
  );
}
