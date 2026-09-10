import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { Nav, NavLink } from "@/components/Nav";
import { Button } from "@/components/Button";
import { SignOutButton } from "@/components/SignOutButton";
import { DropCard } from "@/components/DropCard";
import { FollowButton } from "@/components/FollowButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PHONE_SESSION_COOKIE, verifyPhoneSessionCookieValue } from "@/lib/phone-session";
import { PhoneLookupForm } from "./PhoneLookupForm";
import { PlayerRow } from "./PlayerRow";
import { ReportProblemButton } from "@/components/ReportProblemButton";
import { formatNaira } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import type { PlayerTrack } from "@/lib/player-context";
import type { Artist, Drop } from "@/lib/types";
import { trackPath, dropPath } from "@/lib/slug";
import { type FanIdentity } from "@/lib/fan-identity";
import {
  NewDropNotifications,
  type FanNotification,
} from "@/components/NewDropNotifications";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://preem.ng";

function formatPurchaseDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const GHOST_DROPS: Drop[] = [
  {
    id: "ghost-1",
    slug: null,
    artist_id: "ghost-artist-1",
    title: "Your first drop will show up here",
    description: null,
    release_type: "single",
    status: "published",
    genre: "other",
    secondary_genre: null,
    min_price_kobo: 50000,
    artwork_path: null,
    window_start: new Date().toISOString(),
    window_end: null,
    is_exclusive: false,
    created_at: new Date().toISOString(),
    artist: { id: "ghost-artist-1", stage_name: "Artist name", avatar_url: null },
  },
  {
    id: "ghost-2",
    slug: null,
    artist_id: "ghost-artist-2",
    title: "Buy access to unlock it",
    description: null,
    release_type: "single",
    status: "published",
    genre: "other",
    secondary_genre: null,
    min_price_kobo: 50000,
    artwork_path: null,
    window_start: new Date().toISOString(),
    window_end: null,
    is_exclusive: false,
    created_at: new Date().toISOString(),
    artist: { id: "ghost-artist-2", stage_name: "Artist name", avatar_url: null },
  },
];

export const revalidate = 0;

export default async function MyDropsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const sortMode = sort === "az" || sort === "artist" ? sort : "recent";

  const cookieStore = await cookies();
  const phoneSession = verifyPhoneSessionCookieValue(
    cookieStore.get(PHONE_SESSION_COOKIE)?.value,
  );

  const supabase = await createClient();
  const {
    data: { user: fan },
  } = await supabase.auth.getUser();

  // Reuse the identity already resolved above rather than re-reading the
  // session (getFanIdentity would repeat the auth round-trip).
  const identity: FanIdentity | null = fan
    ? { kind: "user", userId: fan.id }
    : phoneSession
      ? { kind: "phone", session: phoneSession }
      : null;
  const notifications = identity ? await getNotifications(identity) : [];

  const admin = createAdminClient();
  const [{ data: liveDrops }, { data: artistsData }, { data: followRows }] =
    await Promise.all([
      admin
        .from("drops")
        .select("*, artist:artists(id, stage_name, avatar_url)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("artists")
        .select("id, stage_name, avatar_url, approval_status")
        .eq("approval_status", "approved")
        .order("created_at", { ascending: false })
        .limit(20),
      identity
        ? identity.kind === "user"
          ? admin
              .from("artist_follows")
              .select("artist_id")
              .eq("fan_user_id", identity.userId)
          : admin
              .from("artist_follows")
              .select("artist_id")
              .eq("fan_phone", identity.session.phone)
        : Promise.resolve({ data: [] as { artist_id: string }[] }),
    ]);

  const followedIds = new Set((followRows ?? []).map((f) => f.artist_id));
  const artists = ((artistsData ?? []) as Artist[]).filter((a) => a.approval_status === "approved");
  const followed = artists.filter((a) => followedIds.has(a.id));
  const suggested = artists.filter((a) => !followedIds.has(a.id)).slice(0, 10);
  const artistSection = [...followed, ...suggested].slice(0, 12);

  const followerCounts = new Map<string, number>();
  if (artistSection.length > 0) {
    const { data: followCounts } = await admin
      .from("artist_follows")
      .select("artist_id")
      .in(
        "artist_id",
        artistSection.map((a) => a.id),
      );
    for (const f of followCounts ?? []) {
      followerCounts.set(f.artist_id, (followerCounts.get(f.artist_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <Nav role="fan">
        <NavLink href="/fans/search">Search</NavLink>
        {(fan || phoneSession) && <SignOutButton redirectTo="/fans" />}
      </Nav>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
        <NewDropNotifications items={notifications} />
        <Link
          href="/fans/search"
          className="mb-8 flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-muted transition-colors hover:border-line-strong hover:text-paper"
        >
          Search artists or songs…
        </Link>

        {fan ? (
          <MyDropsLibrary userId={fan.id} sortMode={sortMode} continueSection />
        ) : !phoneSession ? (
          <PhoneLookupForm />
        ) : (
          <MyDropsLibrary
            phone={phoneSession.phone}
            email={phoneSession.email}
            sortMode={sortMode}
            continueSection
          />
        )}

        {(liveDrops ?? []).length > 0 && (
          <section className="mb-10 mt-10">
            <h2 className="mb-4 text-lg font-bold">New drops</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {((liveDrops ?? []) as Drop[]).map((drop) => (
                <div key={drop.id} className="w-40 flex-shrink-0 sm:w-48">
                  <DropCard drop={drop} />
                </div>
              ))}
            </div>
          </section>
        )}

        {artistSection.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-bold">
              {followed.length > 0 ? "Your artists" : "Artists to follow"}
            </h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {artistSection.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3">
                  <Link
                    href={`/artist/${a.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
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
                  <FollowButton
                    artistId={a.id}
                    artistName={a.stage_name}
                    followerCount={followerCounts.get(a.id) ?? 0}
                    initialFollowing={followedIds.has(a.id)}
                    hasIdentity={!!identity}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 text-center">
          <ReportProblemButton defaultPhone={phoneSession?.phone ?? ""} />
        </div>
      </main>
    </>
  );
}

// Unseen "new drop" banners for everything this fan follows. Runs on the
// server so the identity never round-trips through the client.
async function getNotifications(identity: FanIdentity): Promise<FanNotification[]> {
  const admin = createAdminClient();
  let followsQuery = admin.from("artist_follows").select("id");
  followsQuery =
    identity.kind === "user"
      ? followsQuery.eq("fan_user_id", identity.userId)
      : followsQuery.eq("fan_phone", identity.session.phone);
  const { data: follows } = await followsQuery;
  const followIds = (follows ?? []).map((f) => f.id as string);
  if (followIds.length === 0) return [];

  const { data: notifications } = await admin
    .from("fan_notifications")
    .select("id, drop_id, drops(title, artist:artists(stage_name))")
    .in("follow_id", followIds)
    .is("seen_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  return (notifications ?? []).flatMap((n) => {
    type Row = {
      id: string;
      drops: { title: string; artist: { stage_name: string } | { stage_name: string }[] | null } | null;
    };
    const row = n as unknown as Row;
    const drop = row.drops;
    if (!drop) return [];
    const artist = Array.isArray(drop.artist) ? drop.artist[0] : drop.artist;
    const artistName = artist?.stage_name ?? "";
    const href = dropPath(artistName, drop.title);
    const text = `${artistName} just released "${drop.title}" on Preem — listen here: ${APP_URL}${href}`;
    return [
      {
        id: row.id,
        artistName,
        dropTitle: drop.title,
        dropHref: href,
        whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
      },
    ];
  });
}

type DropInfo = {
  id: string;
  title: string;
  artwork_path: string | null;
  artist: { id: string; stage_name: string } | { id: string; stage_name: string }[] | null;
};

type TrackInfo = {
  id: string;
  drop_id: string;
  track_number: number;
  title: string;
  lyrics: string | null;
  lyrics_lrc: string | null;
};

async function MyDropsLibrary({
  phone,
  email,
  userId,
  sortMode,
  continueSection,
}: {
  phone?: string;
  email?: string;
  userId?: string;
  sortMode: "recent" | "az" | "artist";
  continueSection: boolean;
}) {
  const admin = createAdminClient();

  let purchasesQuery = admin
    .from("purchases")
    .select("drop_id, track_id, purchased_at, amount_kobo")
    .eq("status", "success")
    .order("purchased_at", { ascending: false });
  if (userId) {
    purchasesQuery = purchasesQuery.eq("fan_user_id", userId);
  } else {
    // Phone sessions are scoped to both checkout identity halves.
    purchasesQuery = purchasesQuery
      .eq("fan_phone", phone!)
      .ilike("fan_email", email!);
  }
  const { data: purchases } = await purchasesQuery;

  if (!purchases || purchases.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-bold">Your library</h2>
        <p className="mb-6 text-sm text-muted">
          Nothing here yet — buy access to a drop and it&apos;ll show up here permanently.
        </p>
        <Button href="/" variant="primary" className="mb-8">
          Browse live drops
        </Button>
        <div className="grid grid-cols-2 gap-4 opacity-40 sm:grid-cols-3">
          {GHOST_DROPS.map((drop) => (
            <div key={drop.id} className="pointer-events-none select-none">
              <DropCard drop={drop} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // What a fan paid for each drop, and when — purchases is already sorted
  // most-recent-first, so the first row seen per drop is its purchase date;
  // amounts are summed since a drop can be bought as a bundle plus
  // individual tracks across separate checkouts.
  const purchaseSummaryByDrop = new Map<string, { totalKobo: number; purchasedAt: string | null }>();
  for (const p of purchases) {
    const entry = purchaseSummaryByDrop.get(p.drop_id);
    if (entry) {
      entry.totalKobo += p.amount_kobo;
    } else {
      purchaseSummaryByDrop.set(p.drop_id, { totalKobo: p.amount_kobo, purchasedAt: p.purchased_at });
    }
  }

  const bundleDropIds = [...new Set(purchases.filter((p) => !p.track_id).map((p) => p.drop_id))];
  const specificTrackIds = [...new Set(purchases.filter((p) => p.track_id).map((p) => p.track_id as string))];
  const dropIdsInOrder = [...new Set(purchases.map((p) => p.drop_id))];

  const { data: dropsData } = await admin
    .from("drops")
    .select("id, title, artwork_path, artist:artists(id, stage_name)")
    .in("id", dropIdsInOrder);
  const dropById = new Map((dropsData as DropInfo[] | null ?? []).map((d) => [d.id, d]));

  const trackQueries = [];
  if (bundleDropIds.length > 0) {
    trackQueries.push(
      admin
        .from("drop_tracks")
        .select("id, drop_id, track_number, title, lyrics, lyrics_lrc")
        .in("drop_id", bundleDropIds),
    );
  }
  if (specificTrackIds.length > 0) {
    trackQueries.push(
      admin
        .from("drop_tracks")
        .select("id, drop_id, track_number, title, lyrics, lyrics_lrc")
        .in("id", specificTrackIds),
    );
  }
  const trackResults = await Promise.all(trackQueries);
  const trackById = new Map<string, TrackInfo>();
  for (const res of trackResults) {
    for (const t of (res.data as TrackInfo[] | null) ?? []) {
      trackById.set(t.id, t);
    }
  }

  const tracksByDrop = new Map<string, TrackInfo[]>();
  for (const t of trackById.values()) {
    const list = tracksByDrop.get(t.drop_id) ?? [];
    list.push(t);
    tracksByDrop.set(t.drop_id, list);
  }
  for (const list of tracksByDrop.values()) {
    list.sort((a, b) => a.track_number - b.track_number);
  }

  const unsortedRows = dropIdsInOrder
    .map((dropId) => {
      const drop = dropById.get(dropId);
      if (!drop) return null;
      const artist = Array.isArray(drop.artist) ? drop.artist[0] : drop.artist;
      const tracks = tracksByDrop.get(dropId) ?? [];
      return { dropId, drop, artistName: artist?.stage_name ?? "", artistId: artist?.id ?? "", tracks };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const rowTitle = (r: (typeof unsortedRows)[number]) =>
    r.tracks.length <= 1 ? (r.tracks[0]?.title ?? r.drop.title) : r.drop.title;
  const rows = [...unsortedRows].sort((a, b) => {
    if (sortMode === "az") return rowTitle(a).localeCompare(rowTitle(b));
    if (sortMode === "artist")
      return (
        a.artistName.localeCompare(b.artistName) || rowTitle(a).localeCompare(rowTitle(b))
      );
    return 0;
  });

  // The fan's whole library, in display order — lets Next/Previous on the
  // player bar continue seamlessly across drops, not just within one.
  const queue: PlayerTrack[] = rows.flatMap(({ dropId, drop, artistName, artistId, tracks }) => {
    if (tracks.length <= 1) {
      const track = tracks[0];
      return [
        {
          trackId: track?.id ?? dropId,
          title: track?.title ?? drop.title,
          artistName,
          artistId,
          artworkUrl: drop.artwork_path,
          lyrics: track?.lyrics ?? null,
          lyricsLrc: track?.lyrics_lrc ?? null,
          collectionTitle: drop.title,
        },
      ];
    }
    return tracks.map((track) => ({
      trackId: track.id,
      title: track.title,
      artistName,
      artistId,
      artworkUrl: drop.artwork_path,
      lyrics: track.lyrics,
      lyricsLrc: track.lyrics_lrc,
      collectionTitle: drop.title,
    }));
  });

  // Continue listening: the first few playable items in display order.
  const continueItems = rows
    .flatMap(({ dropId, drop, artistName, artistId, tracks }) =>
      (tracks.length <= 1 ? [tracks[0]] : tracks).map((track) => ({
        dropId,
        trackId: track?.id ?? dropId,
        title: track?.title ?? drop.title,
        artistName,
        artistId,
        artworkUrl: drop.artwork_path,
        lyrics: track?.lyrics ?? null,
        lyricsLrc: track?.lyrics_lrc ?? null,
        sharePath: trackPath(artistName, drop.title, track?.title),
      })),
    )
    .slice(0, 5);

  const sortPill = (mode: "recent" | "az" | "artist", label: string) => (
    <Link
      key={mode}
      href={mode === "recent" ? "/fans" : `/fans?sort=${mode}`}
      aria-current={sortMode === mode ? "true" : undefined}
      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
        sortMode === mode
          ? "bg-surface-2 text-paper"
          : "text-muted hover:text-paper"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      {continueSection && continueItems.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold">Continue listening</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {continueItems.map((t) => (
              <PlayerRow
                key={t.trackId}
                dropId={t.dropId}
                trackId={t.trackId}
                title={t.title}
                artistName={t.artistName}
                artistId={t.artistId}
                artworkUrl={t.artworkUrl}
                lyrics={t.lyrics}
                lyricsLrc={t.lyricsLrc}
                sharePath={t.sharePath}
                queue={queue}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Your library</h2>
          <div className="flex items-center gap-1">
            {sortPill("recent", "Recent")}
            {sortPill("az", "A–Z")}
            {sortPill("artist", "Artist")}
          </div>
        </div>
        <div>
        {rows.map(({ dropId, drop, artistName, artistId, tracks }) => {
          const summary = purchaseSummaryByDrop.get(dropId);
          const purchaseNote = summary
            ? `${formatNaira(summary.totalKobo)} · ${formatPurchaseDate(summary.purchasedAt)}`
            : "";

          if (tracks.length <= 1) {
            const track = tracks[0];
            return (
              <PlayerRow
                key={dropId}
                dropId={dropId}
                trackId={track?.id ?? dropId}
                title={track?.title ?? drop.title}
                artistName={artistName}
                artistId={artistId}
                artworkUrl={drop.artwork_path}
                lyrics={track?.lyrics}
                lyricsLrc={track?.lyrics_lrc}
                sharePath={trackPath(artistName, drop.title, track?.title)}
                purchaseNote={purchaseNote}
                queue={queue}
              />
            );
          }

          return (
            <div key={dropId} className="border-b border-line py-3 last:border-none">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <div className="text-sm font-bold">{drop.title}</div>
                <div className="flex-shrink-0 text-[11px] text-muted">{purchaseNote}</div>
              </div>
              <div className="pl-2">
                {tracks.map((track) => (
                  <PlayerRow
                    key={track.id}
                    dropId={dropId}
                    trackId={track.id}
                    title={track.title}
                    artistName={artistName}
                    artistId={artistId}
                    artworkUrl={drop.artwork_path}
                    lyrics={track.lyrics}
                    lyricsLrc={track.lyrics_lrc}
                    sharePath={trackPath(artistName, drop.title, track.title)}
                    queue={queue}
                  />
                ))}
              </div>
            </div>
          );
        })}
        </div>
      </section>
    </div>
  );
}
