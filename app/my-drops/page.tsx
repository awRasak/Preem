import { cookies } from "next/headers";
import { Nav } from "@/components/Nav";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHONE_SESSION_COOKIE, verifyPhoneSessionCookieValue } from "@/lib/phone-session";
import { PhoneLookupForm } from "./PhoneLookupForm";
import { PlayerRow } from "./PlayerRow";

export const revalidate = 0;

export default async function MyDropsPage() {
  const cookieStore = await cookies();
  const phone = verifyPhoneSessionCookieValue(
    cookieStore.get(PHONE_SESSION_COOKIE)?.value,
  );

  return (
    <>
      <Nav role="fan" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        {!phone ? (
          <PhoneLookupForm />
        ) : (
          <MyDropsLibrary phone={phone} />
        )}
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

async function MyDropsLibrary({ phone }: { phone: string }) {
  const admin = createAdminClient();

  const { data: purchases } = await admin
    .from("purchases")
    .select("drop_id, track_id, purchased_at")
    .eq("fan_phone", phone)
    .eq("status", "success")
    .order("purchased_at", { ascending: false });

  if (!purchases || purchases.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">My Drops</h1>
        <p className="text-sm text-muted">
          Nothing here yet — buy access to a drop and it&apos;ll show up here permanently.
        </p>
      </div>
    );
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My Drops</h1>
      <div>
        {dropIdsInOrder.map((dropId) => {
          const drop = dropById.get(dropId);
          if (!drop) return null;
          const artist = Array.isArray(drop.artist) ? drop.artist[0] : drop.artist;
          const tracks = tracksByDrop.get(dropId) ?? [];

          if (tracks.length <= 1) {
            const track = tracks[0];
            return (
              <PlayerRow
                key={dropId}
                trackId={track?.id ?? dropId}
                title={track?.title ?? drop.title}
                artistName={artist?.stage_name ?? ""}
                artworkUrl={drop.artwork_path}
                lyrics={track?.lyrics}
              />
            );
          }

          return (
            <div key={dropId} className="border-b border-line py-3 last:border-none">
              <div className="mb-2 text-sm font-bold">{drop.title}</div>
              <div className="pl-2">
                {tracks.map((track) => (
                  <PlayerRow
                    key={track.id}
                    trackId={track.id}
                    title={track.title}
                    artistName={artist?.stage_name ?? ""}
                    artworkUrl={drop.artwork_path}
                    lyrics={track.lyrics}
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
