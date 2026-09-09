import { createClient } from "@/lib/supabase/server";
import { ArtistsTable, type AdminArtist } from "../../ArtistsTable";

export const revalidate = 0;

export default async function AdminArtistsPage() {
  const supabase = await createClient();

  // Independent queries fired together: the artist directory, every drop's
  // owner (for per-artist drop counts), and every successful purchase's
  // artist via the drops join (for per-artist sales counts).
  const [{ data: artists }, { data: drops }, { data: successPurchases }] =
    await Promise.all([
      supabase
        .from("artists")
        .select("id, stage_name, approval_status, profile_link, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("drops").select("artist_id").limit(2000),
      supabase
        .from("purchases")
        .select("id, drops!inner(artist_id)")
        .eq("status", "success")
        .limit(2000),
    ]);

  const dropCountByArtist = new Map<string, number>();
  for (const d of drops ?? []) {
    dropCountByArtist.set(d.artist_id, (dropCountByArtist.get(d.artist_id) ?? 0) + 1);
  }

  const salesCountByArtist = new Map<string, number>();
  for (const p of successPurchases ?? []) {
    const drop = p.drops as unknown as { artist_id: string } | { artist_id: string }[] | null;
    const artistId = Array.isArray(drop) ? drop[0]?.artist_id : drop?.artist_id;
    if (!artistId) continue;
    salesCountByArtist.set(artistId, (salesCountByArtist.get(artistId) ?? 0) + 1);
  }

  const adminArtists: AdminArtist[] = (artists ?? []).map((a) => ({
    id: a.id,
    stageName: a.stage_name,
    approvalStatus: a.approval_status,
    profileLink: a.profile_link,
    dropCount: dropCountByArtist.get(a.id) ?? 0,
    salesCount: salesCountByArtist.get(a.id) ?? 0,
    createdAt: a.created_at,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Artists ({adminArtists.length})</h1>
      <ArtistsTable artists={adminArtists} />
    </main>
  );
}
