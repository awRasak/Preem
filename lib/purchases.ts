import type { SupabaseClient } from "@supabase/supabase-js";

// Idempotent: safe to call from both the webhook and the client-side verify
// callback, whichever lands first.
export async function markPurchaseSuccess(
  supabase: SupabaseClient,
  reference: string,
) {
  const { data: purchase } = await supabase
    .from("purchases")
    .select("*")
    .eq("paystack_ref", reference)
    .single();

  if (!purchase) return null;
  if (purchase.status === "success") return purchase;

  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from("purchases")
    .update({ status: "success", purchased_at: now, access_granted_at: now })
    .eq("id", purchase.id)
    .select()
    .single();

  return updated;
}
