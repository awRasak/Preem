import type { SupabaseClient } from "@supabase/supabase-js";
import { sendReceiptEmail } from "@/lib/email";

// Idempotent: safe to call from both the webhook and the client-side verify
// callback, whichever lands first.
//
// expectedAmountKobo is what the gateway reports it actually collected for
// this reference. Access is granted only when it covers the amount recorded
// at initialize time -- without this check a tampered inline popup paying
// less than the committed price would still unlock the drop (and inflate
// artist payouts computed off the stored amount).
export async function markPurchaseSuccess(
  supabase: SupabaseClient,
  reference: string,
  expectedAmountKobo?: number,
) {
  const { data: purchase } = await supabase
    .from("purchases")
    .select("*, drops(title, artist:artists(stage_name))")
    .eq("paystack_ref", reference)
    .single();

  if (!purchase) return null;
  if (purchase.status === "success") return purchase;

  if (
    typeof expectedAmountKobo === "number" &&
    expectedAmountKobo < purchase.amount_kobo
  ) {
    console.error(
      `markPurchaseSuccess refused ${reference}: paid ${expectedAmountKobo} < recorded ${purchase.amount_kobo}`,
    );
    return null;
  }

  // Conditional on status so exactly one of two concurrent calls (webhook
  // vs verify callback) performs the transition and sends the receipt.
  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from("purchases")
    .update({ status: "success", purchased_at: now, access_granted_at: now })
    .eq("id", purchase.id)
    .eq("status", "pending")
    .select()
    .single();

  if (updated) {
    type DropInfo = { title: string; artist: { stage_name: string } | { stage_name: string }[] | null };
    const rawDrop = purchase.drops as DropInfo | DropInfo[] | null;
    const drop = Array.isArray(rawDrop) ? rawDrop[0] : rawDrop;
    const artist = drop ? (Array.isArray(drop.artist) ? drop.artist[0] : drop.artist) : null;

    // Best-effort: a failed/unconfigured email provider should never break checkout.
    sendReceiptEmail({
      to: updated.fan_email,
      fanName: updated.fan_name,
      dropTitle: drop?.title ?? "your track",
      artistName: artist?.stage_name ?? "",
      amountKobo: updated.amount_kobo,
      reference: updated.paystack_ref,
    }).catch((err) => console.error("sendReceiptEmail failed:", err));
  }

  // A concurrent caller that lost the transition race re-reads its own
  // earlier snapshot; surface the now-current record instead.
  if (!updated) {
    const { data: current } = await supabase
      .from("purchases")
      .select("*")
      .eq("paystack_ref", reference)
      .single();
    return current ?? null;
  }

  return updated;
}
