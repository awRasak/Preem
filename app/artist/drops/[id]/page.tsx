import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { DistributionGuidance } from "@/components/DistributionGuidance";
import { formatNaira, isDropLive } from "@/lib/format";
import { DropHeaderEditable } from "./DropHeaderEditable";
import type { Drop, DropTrack } from "@/lib/types";

export default async function ArtistDropDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: drop } = await supabase
    .from("drops")
    .select("*, artist:artists(stage_name)")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();

  if (!drop) notFound();

  const artistName = Array.isArray(drop.artist)
    ? drop.artist[0]?.stage_name
    : drop.artist?.stage_name;

  const { data: tracksData } = await supabase
    .from("drop_tracks")
    .select("*")
    .eq("drop_id", id)
    .order("track_number", { ascending: true });
  const tracks = (tracksData ?? []) as DropTrack[];

  const { data: buyers } = await supabase
    .from("purchases")
    .select("fan_name, fan_phone, amount_kobo, purchased_at, track_id")
    .eq("drop_id", id)
    .eq("status", "success")
    .order("purchased_at", { ascending: false });

  const live = isDropLive(drop.window_end);
  const isBundle = drop.release_type !== "single" && tracks.length > 1;
  const trackTitleById = new Map(tracks.map((t) => [t.id, t.title]));

  return (
    <>
      <Nav role="artist">
        <NavLink href="/artist/dashboard">← Dashboard</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8">
        <DropHeaderEditable
          drop={drop as Drop}
          tracks={tracks}
          artistName={artistName ?? ""}
          hasSales={(buyers?.length ?? 0) > 0}
        />

        {!live && <DistributionGuidance dropId={drop.id} />}

        <h2 className="mb-3 text-lg font-bold">Buyers ({buyers?.length ?? 0})</h2>
        <div className="divide-y divide-line rounded-xl border border-line">
          {(buyers ?? []).length === 0 && (
            <p className="p-5 text-sm text-muted">No sales yet.</p>
          )}
          {buyers?.map((b, i) => (
            <div key={i} className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="font-medium">{b.fan_name}</div>
                <div className="text-xs text-muted">
                  {b.fan_phone}
                  {isBundle && (
                    <>
                      {" · "}
                      {b.track_id ? (trackTitleById.get(b.track_id) ?? "Deleted track") : "Full release"}
                    </>
                  )}
                </div>
              </div>
              <span className="font-mono text-accent">
                {formatNaira(b.amount_kobo)}
              </span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
