import { createAdminClient } from "@/lib/supabase/admin";
import { MerchOpsTable } from "./MerchOpsTable";

// Preem ships every merch order: this is the ops queue. Advance each order
// down the fulfillment line; low-stock and oversold items surface above it
// so restocks happen before the next buyer hits a dead button.
export default async function AdminMerchPage() {
  const supabase = createAdminClient();

  const [{ data: orders }, { data: items }, { data: zones }] = await Promise.all([
    supabase
      .from("merch_orders")
      .select(
        "id, fan_name, fan_phone, address, zone_label, quantity, amount_kobo, fulfillment, purchased_at, created_at, merch_items!inner(id, title, stock, artist:artists!drops_artist_id_fkey(id, stage_name))",
      )
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("merch_items")
      .select("id, title, stock, status, artist:artists!drops_artist_id_fkey(stage_name)")
      .eq("status", "published")
      .order("stock", { ascending: true })
      .limit(50),
    supabase
      .from("delivery_zones")
      .select("id, label, fee_kobo")
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Merch ops</h1>
      <MerchOpsTable
        orders={(orders ?? []) as unknown as import("./MerchOpsTable").OpsOrder[]}
        items={(items ?? []) as unknown as import("./MerchOpsTable").OpsItem[]}
        zones={(zones ?? []) as unknown as import("./MerchOpsTable").OpsZone[]}
      />
    </main>
  );
}
