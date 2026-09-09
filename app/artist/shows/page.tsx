import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArtistShell } from "@/components/ArtistShell";
import { ShowsManager } from "./ShowsManager";
import type { Show } from "@/lib/types";

export default async function ArtistShowsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("approval_status, stage_name, avatar_url")
    .eq("id", user.id)
    .single();
  if (!artist || artist.approval_status !== "approved") redirect("/artist/dashboard");

  const { data: shows } = await supabase
    .from("shows")
    .select("*")
    .eq("artist_id", user.id)
    .order("start_at", { ascending: false });

  const showIds = (shows ?? []).map((s) => s.id);
  const { data: showTicketRows } =
    showIds.length > 0
      ? await supabase
          .from("show_tickets")
          .select("show_id")
          .in("show_id", showIds)
          .eq("status", "success")
      : { data: [] };

  const soldByShow = new Map<string, number>();
  for (const t of showTicketRows ?? []) {
    soldByShow.set(t.show_id, (soldByShow.get(t.show_id) ?? 0) + 1);
  }

  return (
    <ArtistShell
      active="shows"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-6 text-xl font-bold">Shows</h1>
        <ShowsManager
          artistId={user.id}
          shows={(shows as Show[] | null)?.map((show) => ({
            id: show.id,
            title: show.title,
            venue: show.venue,
            city: show.city,
            start_at: show.start_at,
            ticket_price_kobo: show.ticket_price_kobo,
            total_tickets: show.total_tickets,
            cover_art_path: show.cover_art_path,
            status: show.status,
            soldCount: soldByShow.get(show.id) ?? 0,
          })) ?? []}
        />
      </main>
    </ArtistShell>
  );
}