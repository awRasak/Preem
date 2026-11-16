import type { Metadata } from "next";
import { Nav, NavLink } from "@/components/Nav";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExploreTabs } from "./ExploreTabs";
import type { Artist, Drop } from "@/lib/types";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Explore — Nigerian artists, drops, tickets & live shows | Preem",
  description:
    "Discover Nigerian artists selling early access to unreleased music, tickets to live shows, and merch — direct to fans in naira on Preem.",
};

export default async function ExplorePage() {
  const supabase = await createClient();

  const { data: dropsData } = await supabase
    .from("drops")
    .select("*, artist:artists!drops_artist_id_fkey(id, stage_name, avatar_url, approval_status)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const drops = ((dropsData ?? []) as (Drop & {
    artist: {
      id: string;
      stage_name: string;
      avatar_url: string | null;
      approval_status: string;
    } | null;
  })[]).filter((d) => d.artist?.approval_status === "approved");

  const { data: artistsData } = await supabase
    .from("artists")
    .select("*")
    .eq("approval_status", "approved")
    .order("stage_name", { ascending: true });

  const artists = (artistsData ?? []) as Artist[];

  // Shows need an admin-client pass for sold counts (show_tickets has no
  // anonymous RLS policy).
  const admin = createAdminClient();
  const { data: showsData } = await supabase
    .from("shows")
    .select("*, artist:artists!shows_artist_id_fkey(id, stage_name, avatar_url), tiers:show_ticket_tiers(id, name, price_kobo, quantity, design, sort_order)")
    .eq("status", "published")
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  const showIds = (showsData ?? []).map((s) => s.id);
  const { data: soldTickets } =
    showIds.length > 0
      ? await admin
          .from("show_tickets")
          .select("show_id, tier_id")
          .in("show_id", showIds)
          .eq("status", "success")
      : { data: [] };
  const soldByShow = new Map<string, number>();
  for (const t of soldTickets ?? []) {
    soldByShow.set(t.show_id, (soldByShow.get(t.show_id) ?? 0) + 1);
  }

  const shows = ((showsData ?? []) as (import("@/lib/types").Show & {
    artist: {
      id: string;
      stage_name: string;
      avatar_url: string | null;
    } | null;
  })[]).filter((s) => s.artist);

  const showCards = shows.map((show) => ({
    id: show.id,
    slug: show.slug,
    title: show.title,
    venue: show.venue,
    city: show.city,
    start_at: show.start_at,
    sales_close_at: show.sales_close_at ?? null,
    ticket_price_kobo: show.ticket_price_kobo,
    total_tickets: show.total_tickets,
    cover_art_path: show.cover_art_path,
    soldCount: soldByShow.get(show.id) ?? 0,
    artist: show.artist ?? undefined,
    artist_name: show.artist?.stage_name,
    tiers: (show.tiers ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      price_kobo: t.price_kobo,
      quantity: t.quantity,
      design: t.design,
    })),
  }));

  return (
    <>
      <Nav>
        <NavLink href="/artist/signup">For artists</NavLink>
        <Button href="/artist/login" variant="outline">
          Sign in
        </Button>
      </Nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-2 text-2xl font-bold">
          Explore Nigerian artists&apos; drops &amp; live shows
        </h1>
        <p className="mb-6 text-sm text-muted">
          Browse early-access music, upcoming concert tickets, and merch —
          sold direct to fans, priced in naira.
        </p>
        <ExploreTabs drops={drops} artists={artists} shows={showCards} />
      </main>
    </>
  );
}