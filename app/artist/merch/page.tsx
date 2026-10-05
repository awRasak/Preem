import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArtistShell } from "@/components/ArtistShell";
import { MerchManager } from "./MerchManager";

// Artist merch hub: catalogue (items, stock, publish state) plus a
// read-only view of orders. Fulfillment itself is Preem ops (admin side) --
// artists see where each order stands but don't advance it.
export default async function ArtistMerchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("id, stage_name, avatar_url, approval_status")
    .eq("id", user.id)
    .single();
  if (!artist || artist.approval_status !== "approved") redirect("/artist/dashboard");

  const [{ data: items }, { data: orders }] = await Promise.all([
    supabase
      .from("merch_items")
      .select("*")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("merch_orders")
      .select("id, fan_name, fan_phone, address, zone_label, quantity, amount_kobo, status, fulfillment, purchased_at, created_at, merch_items!inner(id, title)")
      .eq("merch_items.artist_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return (
    <ArtistShell
      active="merch"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold">Merch</h1>
        </div>
        <p className="mb-8 text-sm text-muted">
          Physical goods, sold direct. You stock the catalogue — Preem ships
          every order. All sales final; problem orders go through Preem support.
        </p>
        <MerchManager
          initialItems={(items ?? []) as unknown as import("@/lib/types").MerchItem[]}
          initialOrders={(orders ?? []) as unknown as {
            id: string;
            fan_name: string;
            fan_phone: string;
            address: string;
            zone_label: string;
            quantity: number;
            amount_kobo: number;
            status: string;
            fulfillment: string;
            purchased_at: string | null;
            created_at: string;
            merch_items: { id: string; title: string } | { id: string; title: string }[] | null;
          }[]}
        />
      </main>
    </ArtistShell>
  );
}
