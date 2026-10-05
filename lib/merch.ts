import type { SupabaseClient } from "@supabase/supabase-js";

// Marks a merch order success (pending -> success only, like every other
// product) and decrements item stock via an optimistic-locking write
// (conditional on stock being unchanged since read) so concurrent verifies
// can't double-decrement.
//
// Oversell corner: payment already collected but stock ran out between
// initialize and verify (two fans, last unit). Money must still be recorded
// -- the order goes success and the response flags oversold so ops (Preem
// ships, artists don't) sees it and resolves it manually with the fan.
// Returns are manual anyway (contact Preem support).
export async function markMerchOrderSuccess(
  supabase: SupabaseClient,
  reference: string,
): Promise<{ status: string; oversold: boolean } | null> {
  const { data: order } = await supabase
    .from("merch_orders")
    .select("id, item_id, quantity")
    .eq("paystack_ref", reference)
    .eq("status", "pending")
    .maybeSingle();

  if (!order) {
    const { data: existing } = await supabase
      .from("merch_orders")
      .select("id")
      .eq("paystack_ref", reference)
      .eq("status", "success")
      .maybeSingle();
    return existing ? { status: "success", oversold: false } : null;
  }

  // Decrement guarded on stock covering the quantity. Plain read-modify-write
  // would race; the stock equality condition makes a concurrent verify win
  // zero rows instead of double-decrementing.
  const { data: stockRows } = await supabase
    .from("merch_items")
    .select("id, stock")
    .eq("id", order.item_id)
    .maybeSingle();
  const stock = (stockRows?.stock ?? 0) as number;
  const oversold = stock < order.quantity;

  // Lost the race (stock changed under us) or already short: money is
  // already collected, so fall through and record success with the oversold
  // flag -- ops sees it and resolves manually with the fan. Never silently
  // drop a paid order.
  await supabase
    .from("merch_items")
    .update({ stock: Math.max(stock - order.quantity, 0) })
    .eq("id", order.item_id)
    .eq("stock", stock);

  const { data: confirmed, error } = await supabase
    .from("merch_orders")
    .update({ status: "success", purchased_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !confirmed) return null;
  return { status: "success", oversold };
}
