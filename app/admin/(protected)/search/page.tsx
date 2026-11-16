import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import Image from "next/image";
import { formatNaira } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";

export const revalidate = 0;

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const admin = createAdminClient();

  type ArtistHit = { id: string; stage_name: string; approval_status: string };
  type DropHit = { id: string; title: string; status: string; artist_id: string; artistName: string };
  type ShowHit = { id: string; title: string; status: string; artist_id: string; artistName: string; venue: string | null; city: string | null; cover_art_path: string | null };
  type MerchHit = { id: string; title: string; status: string; stock: number; artistName: string };
  type ListenerHit = { fan_name: string; fan_email: string; fan_phone: string; purchaseCount: number; totalSpentKobo: number };

  let artists: ArtistHit[] = [];
  let drops: DropHit[] = [];
  let shows: ShowHit[] = [];
  let merch: MerchHit[] = [];
  let listeners: ListenerHit[] = [];

  if (query.length >= 2) {
    const like = "%" + query + "%";

    const [
      { data: artistHits },
      { data: dropHits },
      { data: showHits },
      { data: merchHits },
      { data: purchaseHits },
    ] = await Promise.all([
      admin
        .from("artists")
        .select("id, stage_name, approval_status")
        .ilike("stage_name", like)
        .order("stage_name", { ascending: true })
        .limit(10),
      admin
        .from("drops")
        .select("id, title, status, artist_id, artists!drops_artist_id_fkey(stage_name)")
        .ilike("title", like)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("shows")
        .select("id, title, status, artist_id, venue, city, cover_art_path, artists(stage_name)")
        .or("title.ilike." + like + ",venue.ilike." + like + ",city.ilike." + like)
        .order("start_at", { ascending: false })
        .limit(10),
      admin
        .from("merch_items")
        .select("id, title, status, stock, artist:artists!drops_artist_id_fkey(stage_name)")
        .ilike("title", like)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("purchases")
        .select("fan_name, fan_phone, fan_email, amount_kobo")
        .eq("status", "success")
        .or("fan_name.ilike." + like + ",fan_email.ilike." + like + ",fan_phone.ilike." + like)
        .limit(50),
    ]);

    artists = (artistHits ?? []).map((a) => ({
      id: a.id,
      stage_name: a.stage_name,
      approval_status: a.approval_status,
    }));

    drops = (dropHits ?? []).map((d) => {
      const artist = d.artists as unknown as { stage_name: string } | { stage_name: string }[] | null;
      const artistName = Array.isArray(artist) ? artist[0]?.stage_name : artist?.stage_name;
      return {
        id: d.id,
        title: d.title,
        status: d.status,
        artist_id: d.artist_id,
        artistName: artistName ?? "Unknown",
      };
    });

    shows = (showHits ?? []).map((s) => {
      const artist = s.artists as unknown as { stage_name: string } | { stage_name: string }[] | null;
      const artistName = Array.isArray(artist) ? artist[0]?.stage_name : artist?.stage_name;
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        artist_id: s.artist_id,
        artistName: artistName ?? "Unknown",
        venue: s.venue,
        city: s.city,
        cover_art_path: s.cover_art_path,
      };
    });

    merch = (merchHits ?? []).map((m) => {
      const artist = m.artist as unknown as { stage_name: string } | { stage_name: string }[] | null;
      const artistName = Array.isArray(artist) ? artist[0]?.stage_name : artist?.stage_name;
      return {
        id: m.id,
        title: m.title,
        status: m.status,
        stock: m.stock,
        artistName: artistName ?? "Unknown",
      };
    });

    const byPhone = new Map<string, ListenerHit>();
    for (const p of purchaseHits ?? []) {
      const existing = byPhone.get(p.fan_phone);
      if (existing) {
        existing.purchaseCount += 1;
        existing.totalSpentKobo += p.amount_kobo;
      } else {
        byPhone.set(p.fan_phone, {
          fan_name: p.fan_name,
          fan_email: p.fan_email,
          fan_phone: p.fan_phone,
          purchaseCount: 1,
          totalSpentKobo: p.amount_kobo,
        });
      }
    }
    listeners = [...byPhone.values()];
  }

  const totalResults = artists.length + drops.length + shows.length + merch.length + listeners.length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-2 text-xl font-bold">Search</h1>
      {query.length >= 2 ? (
        <p className="mb-6 text-sm text-muted">
          {totalResults} result{totalResults === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
        </p>
      ) : (
        <p className="mb-6 text-sm text-muted">Type at least 2 characters to search.</p>
      )}

      {query.length >= 2 && totalResults === 0 && (
        <p className="text-sm text-muted">No results found.</p>
      )}

      {artists.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Artists ({artists.length})</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {artists.map((a) => (
              <Link
                key={a.id}
                href="/admin/artists"
                className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/50"
              >
                <div>
                  <div className="text-sm font-medium">{a.stage_name}</div>
                  <div className="text-xs text-muted">{a.approval_status}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Songs / Drops ({drops.length})</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {drops.map((d) => (
              <Link
                key={d.id}
                href="/admin/songs"
                className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/50"
              >
                <div>
                  <div className="text-sm font-medium">{d.title}</div>
                  <div className="text-xs text-muted">
                    {d.artistName} - {d.status}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {shows.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Events ({shows.length})</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shows.map((s) => (
              <Link
                key={s.id}
                href={"/admin/events/" + s.id}
                className="flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:border-line-strong"
              >
                <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  <Image
                    src={s.cover_art_path || artworkFallback(s.id)}
                    alt={s.title}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-muted">
                    {s.artistName} - {s.status}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {[s.venue, s.city].filter(Boolean).join(" - ") || "TBA"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {merch.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Merch ({merch.length})</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {merch.map((m) => (
              <Link
                key={m.id}
                href="/admin/merch"
                className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/50"
              >
                <div>
                  <div className="text-sm font-medium">{m.title}</div>
                  <div className="text-xs text-muted">
                    {m.artistName} - {m.status} - {m.stock} in stock
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {listeners.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Listeners ({listeners.length})</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {listeners.map((l, i) => (
              <Link
                key={i}
                href="/admin/listeners"
                className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/50"
              >
                <div>
                  <div className="text-sm font-medium">{l.fan_name}</div>
                  <div className="text-xs text-muted">
                    {l.fan_email} - {l.fan_phone}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatNaira(l.totalSpentKobo)}</div>
                  <div className="text-xs text-muted">
                    {l.purchaseCount} purchase{l.purchaseCount === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
