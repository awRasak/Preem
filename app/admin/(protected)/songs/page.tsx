import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/Button";
import { SongsTable, type AdminSong } from "../../SongsTable";

export const revalidate = 0;

export default async function AdminSongsPage() {
  const supabase = await createClient();

  const [{ data: drops }, { data: successPurchases }, { data: allTracks }] = await Promise.all([
    supabase
      .from("drops")
      .select("id, title, artist_id, release_type, status, min_price_kobo, created_at, artists(stage_name)")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("purchases").select("drop_id").eq("status", "success").limit(5000),
    supabase
      .from("drop_tracks")
      .select("id, drop_id, track_number, title")
      .order("track_number", { ascending: true })
      .limit(5000),
  ]);

  const salesCountByDrop = new Map<string, number>();
  for (const p of successPurchases ?? []) {
    salesCountByDrop.set(p.drop_id, (salesCountByDrop.get(p.drop_id) ?? 0) + 1);
  }

  const tracksByDrop = new Map<string, { id: string; number: number; title: string }[]>();
  for (const t of allTracks ?? []) {
    const list = tracksByDrop.get(t.drop_id) ?? [];
    list.push({ id: t.id, number: t.track_number, title: t.title });
    tracksByDrop.set(t.drop_id, list);
  }

  const songs: AdminSong[] = (drops ?? []).map((d) => {
    const artist = d.artists as unknown as
      | { stage_name: string }
      | { stage_name: string }[]
      | null;
    const artistName = Array.isArray(artist) ? artist[0]?.stage_name : artist?.stage_name;
    return {
      id: d.id,
      title: d.title,
      artistId: d.artist_id,
      artistName: artistName ?? "Unknown artist",
      releaseType: d.release_type,
      status: d.status,
      minPriceKobo: d.min_price_kobo,
      salesCount: salesCountByDrop.get(d.id) ?? 0,
      createdAt: d.created_at,
      tracks: tracksByDrop.get(d.id) ?? [],
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Songs ({songs.length})</h1>
        <Button href="/admin/songs/new" variant="primary" className="!px-4 !py-2 text-xs">
          + New drop
        </Button>
      </div>
      <SongsTable songs={songs} />
    </main>
  );
}
