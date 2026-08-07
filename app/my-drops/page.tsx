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

async function MyDropsLibrary({ phone }: { phone: string }) {
  const admin = createAdminClient();

  const { data: purchases } = await admin
    .from("purchases")
    .select(
      "drop_id, purchased_at, drops(id, title, artwork_path, lyrics, artist:artists(stage_name))",
    )
    .eq("fan_phone", phone)
    .eq("status", "success")
    .order("purchased_at", { ascending: false });

  type TrackRow = {
    drop_id: string;
    drops: {
      id: string;
      title: string;
      artwork_path: string | null;
      lyrics: string | null;
      artist: { stage_name: string } | { stage_name: string }[] | null;
    } | null;
  };

  const tracks = ((purchases ?? []) as unknown as TrackRow[]).filter(
    (p) => p.drops,
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My Drops</h1>
      {tracks.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing here yet — buy access to a drop and it&apos;ll show up here permanently.
        </p>
      ) : (
        <div>
          {tracks.map((p) => {
            const drop = p.drops!;
            const artist = Array.isArray(drop.artist)
              ? drop.artist[0]
              : drop.artist;
            return (
              <PlayerRow
                key={p.drop_id}
                dropId={p.drop_id}
                title={drop.title}
                artistName={artist?.stage_name ?? ""}
                artworkUrl={drop.artwork_path}
                lyrics={drop.lyrics}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
