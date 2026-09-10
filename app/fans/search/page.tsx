import Link from "next/link";
import Image from "next/image";
import { Nav, NavLink } from "@/components/Nav";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { artworkFallback } from "@/lib/placeholder";
import { dropPath } from "@/lib/slug";

export const revalidate = 0;

export default async function FanSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user: fan },
  } = await supabase.auth.getUser();

  type ArtistHit = { id: string; stage_name: string; avatar_url: string | null };
  type DropHit = {
    id: string;
    title: string;
    artwork_path: string | null;
    artist: { id: string; stage_name: string } | { id: string; stage_name: string }[] | null;
  };
  type TrackHit = {
    id: string;
    title: string;
    drop_id: string;
    drops: { id: string; title: string; artist: { id: string; stage_name: string } | { id: string; stage_name: string }[] | null } | { id: string; title: string; artist: { id: string; stage_name: string } | { id: string; stage_name: string }[] | null }[] | null;
  };

  let artists: ArtistHit[] = [];
  let drops: DropHit[] = [];
  let tracks: TrackHit[] = [];
  if (query.length >= 2) {
    const admin = createAdminClient();
    const like = `%${query}%`;
    const [{ data: artistHits }, { data: dropHits }, { data: trackHits }] =
      await Promise.all([
        admin
          .from("artists")
          .select("id, stage_name, avatar_url")
          .eq("approval_status", "approved")
          .ilike("stage_name", like)
          .order("stage_name", { ascending: true })
          .limit(8),
        admin
          .from("drops")
          .select("id, title, artwork_path, artist:artists(id, stage_name)")
          .eq("status", "published")
          .ilike("title", like)
          .order("created_at", { ascending: false })
          .limit(8),
        admin
          .from("drop_tracks")
          .select("id, title, drop_id, drops(id, title, artist:artists(id, stage_name))")
          .ilike("title", like)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
    // Tracks are only useful when their parent drop is actually published.
    const { data: liveDropIds } = await admin
      .from("drops")
      .select("id")
      .eq("status", "published")
      .in("id", (trackHits ?? []).map((t) => t.drop_id));
    const liveIds = new Set((liveDropIds ?? []).map((d) => d.id));
    artists = (artistHits ?? []) as ArtistHit[];
    drops = (dropHits ?? []) as DropHit[];
    tracks = ((trackHits ?? []) as TrackHit[]).filter((t) => liveIds.has(t.drop_id));
  }

  const empty =
    query.length >= 2 && artists.length === 0 && drops.length === 0 && tracks.length === 0;

  return (
    <>
      <Nav role="fan">
        <NavLink href="/fans">My Music</NavLink>
        {fan && <SignOutButton redirectTo="/fans" />}
      </Nav>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-6 text-2xl font-bold">Search</h1>
        <form action="/fans/search" method="get" className="mb-8">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Artists or songs…"
            minLength={2}
            autoFocus={query.length === 0}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-paper placeholder:text-muted focus:border-line-strong focus:outline-none"
          />
        </form>

        {query.length > 0 && query.length < 2 && (
          <p className="text-sm text-muted">Type at least 2 characters.</p>
        )}
        {empty && (
          <p className="text-sm text-muted">
            Nothing found for “{query}” — check the spelling or browse live drops below.
          </p>
        )}

        {artists.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">Artists</h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {artists.map((a) => (
                <Link
                  key={a.id}
                  href={`/artist/${a.id}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-2/50"
                >
                  <span className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-surface-2">
                    <Image
                      src={a.avatar_url || artworkFallback(a.id)}
                      alt={a.stage_name}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {a.stage_name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {drops.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">Drops</h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {drops.map((d) => {
                const artist = Array.isArray(d.artist) ? d.artist[0] : d.artist;
                return (
                  <Link
                    key={d.id}
                    href={
                      artist?.stage_name
                        ? dropPath(artist.stage_name, d.title)
                        : `/drop/${d.id}`
                    }
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-2/50"
                  >
                    <span className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      <Image
                        src={d.artwork_path || artworkFallback(d.id)}
                        alt={d.title}
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{d.title}</span>
                      {artist && (
                        <span className="block truncate text-xs text-muted">
                          {artist.stage_name}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {tracks.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">Songs</h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {tracks.map((t) => {
                const drop = Array.isArray(t.drops) ? t.drops[0] : t.drops;
                const artist = drop && (Array.isArray(drop.artist) ? drop.artist[0] : drop.artist);
                return (
                  <Link
                    key={t.id}
                    href={
                      artist?.stage_name && drop
                        ? dropPath(artist.stage_name, drop.title)
                        : `/drop/${t.drop_id}`
                    }
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-2/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {[artist?.stage_name, drop?.title].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
