import { createClient } from "@/lib/supabase/server";
import { EventsTable, type AdminEvent } from "../../EventsTable";

export const revalidate = 0;

export default async function AdminEventsPage() {
  const supabase = await createClient();

  const [{ data: shows }, { data: successTickets }] = await Promise.all([
    supabase
      .from("shows")
      .select(
        "id, title, artist_id, venue, city, start_at, status, ticket_price_kobo, total_tickets, artists(stage_name)",
      )
      .order("start_at", { ascending: false })
      .limit(500),
    supabase.from("show_tickets").select("show_id").eq("status", "success").limit(5000),
  ]);

  const soldByShow = new Map<string, number>();
  for (const t of successTickets ?? []) {
    soldByShow.set(t.show_id, (soldByShow.get(t.show_id) ?? 0) + 1);
  }

  const events: AdminEvent[] = (shows ?? []).map((s) => {
    const artist = s.artists as unknown as
      | { stage_name: string }
      | { stage_name: string }[]
      | null;
    const artistName = Array.isArray(artist) ? artist[0]?.stage_name : artist?.stage_name;
    return {
      id: s.id,
      title: s.title,
      artistId: s.artist_id,
      artistName: artistName ?? "Unknown artist",
      venue: s.venue,
      city: s.city,
      startAt: s.start_at,
      status: s.status,
      ticketPriceKobo: s.ticket_price_kobo,
      ticketsSold: soldByShow.get(s.id) ?? 0,
      totalTickets: s.total_tickets,
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Events ({events.length})</h1>
      <EventsTable events={events} />
    </main>
  );
}
