import { cookies } from "next/headers";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";
import { DropCard } from "@/components/DropCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PHONE_SESSION_COOKIE, verifyPhoneSessionCookieValue } from "@/lib/phone-session";
import { PhoneLookupForm } from "./PhoneLookupForm";
import { PlayerRow } from "./PlayerRow";
import { ReportProblemButton } from "@/components/ReportProblemButton";
import { formatNaira } from "@/lib/format";
import type { PlayerTrack } from "@/lib/player-context";
import type { Drop } from "@/lib/types";

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

export default async function MyDropsPage() {
  const cookieStore = await cookies();
  const phone = verifyPhoneSessionCookieValue(
    cookieStore.get(PHONE_SESSION_COOKIE)?.value,
  );

  const supabase = await createClient();
  const {
    data: { user: fan },
  } = await supabase.auth.getUser();

  return (
    <>
      <Nav role="fan" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        {fan ? (
          <MyDropsLibrary userId={fan.id} />
        ) : !phone ? (
          <PhoneLookupForm />
        ) : (
          <MyDropsLibrary phone={phone} />
        )}
        <div className="mt-10 text-center">
          <ReportProblemButton defaultPhone={phone ?? ""} />
        </div>
      </main>
    </>
  );
}

type DropInfo = {
  id: string;
  title: string;
  artwork_path: string | null;
  artist: { stage_name: string } | { stage_name: string }[] | null;
};

type TrackInfo = {
  id: string;
  drop_id: string;
  track_number: number;
  title: string;
  lyrics: string | null;
};

async function MyDropsLibrary({
  phone,
  userId,
}: {
  phone?: string;
  userId?: string;
}) {
  const admin = createAdminClient();

  let purchasesQuery = admin
    .from("purchases")
    .select("drop_id, track_id, purchased_at, amount_kobo")
    .eq("status", "success")
    .order("purchased_at", { ascending: false });
  purchasesQuery = userId
    ? purchasesQuery.eq("fan_user_id", userId)
    : purchasesQuery.eq("fan_phone", phone!);
  const { data: purchases } = await purchasesQuery;

  if (!purchases || purchases.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">My Music Collections</h1>
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
    .select("id, title, artwork_path, artist:artists(stage_name)")
    .in("id", dropIdsInOrder);
  const dropById = new Map((dropsData as DropInfo[] | null ?? []).map((d) => [d.id, d]));

  const trackQueries = [];
  if (bundleDropIds.length > 0) {
    trackQueries.push(
      admin
        .from("drop_tracks")
        .select("id, drop_id, track_number, title, lyrics")
        .in("drop_id", bundleDropIds),
    );
  }
  if (specificTrackIds.length > 0) {
    trackQueries.push(
      admin
        .from("drop_tracks")
        .select("id, drop_id, track_number, title, lyrics")
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

  const rows = dropIdsInOrder
    .map((dropId) => {
      const drop = dropById.get(dropId);
      if (!drop) return null;
      const artist = Array.isArray(drop.artist) ? drop.artist[0] : drop.artist;
      const tracks = tracksByDrop.get(dropId) ?? [];
      return { dropId, drop, artistName: artist?.stage_name ?? "", tracks };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // The fan's whole library, in display order — lets Next/Previous on the
  // player bar continue seamlessly across drops, not just within one.
  const queue: PlayerTrack[] = rows.flatMap(({ dropId, drop, artistName, tracks }) => {
    if (tracks.length <= 1) {
      const track = tracks[0];
      return [
        {
          trackId: track?.id ?? dropId,
          title: track?.title ?? drop.title,
          artistName,
          artworkUrl: drop.artwork_path,
        },
      ];
    }
    return tracks.map((track) => ({
      trackId: track.id,
      title: track.title,
      artistName,
      artworkUrl: drop.artwork_path,
    }));
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My Music Collections</h1>
      <div>
        {rows.map(({ dropId, drop, artistName, tracks }) => {
          const summary = purchaseSummaryByDrop.get(dropId);
          const purchaseNote = summary
            ? `${formatNaira(summary.totalKobo)} · ${formatPurchaseDate(summary.purchasedAt)}`
            : "";

          if (tracks.length <= 1) {
            const track = tracks[0];
            return (
              <PlayerRow
                key={dropId}
                trackId={track?.id ?? dropId}
                title={track?.title ?? drop.title}
                artistName={artistName}
                artworkUrl={drop.artwork_path}
                lyrics={track?.lyrics}
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
                    trackId={track.id}
                    title={track.title}
                    artistName={artistName}
                    artworkUrl={drop.artwork_path}
                    lyrics={track.lyrics}
                    queue={queue}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
