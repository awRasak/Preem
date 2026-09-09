import type { SupabaseClient } from "@supabase/supabase-js";
import { sendGiftThankYouEmail } from "@/lib/email";

export type GiftRow = {
  id: string;
  status: string;
  amount_kobo: number;
  fan_email: string;
  fan_name: string;
  paystack_ref: string;
};

// Marks a gift confirmed. Idempotent: a no-op when the reference isn't a
// gift, when it's already success, or when the collected amount is short --
// safe to call from both the verify callback and the webhook for the same
// payment.
export async function markGiftSuccess(
  supabase: SupabaseClient,
  reference: string,
  expectedAmountKobo?: number,
): Promise<GiftRow | null> {
  const { data: gift } = await supabase
    .from("gifts")
    .select("*, artists(stage_name)")
    .eq("paystack_ref", reference)
    .single();

  if (!gift) return null;
  if (gift.status === "success") return gift as GiftRow;

  if (
    typeof expectedAmountKobo === "number" &&
    expectedAmountKobo < gift.amount_kobo
  ) {
    console.error(
      `markGiftSuccess refused ${reference}: paid ${expectedAmountKobo} < recorded ${gift.amount_kobo}`,
    );
    return null;
  }

  // Conditional so concurrent retries can't double-send the thank-you.
  const { data: updated } = await supabase
    .from("gifts")
    .update({ status: "success", paid_at: new Date().toISOString() })
    .eq("id", gift.id)
    .eq("status", "pending")
    .select()
    .single();

  if (updated) {
    type WithArtist = { stage_name: string } | { stage_name: string }[] | null;
    const artist = gift.artists as WithArtist;
    const artistName = Array.isArray(artist) ? artist[0]?.stage_name : artist?.stage_name;

    sendGiftThankYouEmail({
      to: gift.fan_email,
      fanName: gift.fan_name,
      artistName: artistName ?? "the artist",
      amountKobo: gift.amount_kobo,
    }).catch((err) => console.error("sendGiftThankYouEmail failed:", err));
  }

  return (updated ?? gift) as GiftRow;
}
