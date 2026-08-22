import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";
import { sendGiftThankYouEmail } from "@/lib/email";

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  let expectedAmountKobo: number | undefined;

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") {
      return NextResponse.json({ status: tx.status });
    }
    // Gateway-collected amount must cover the gift recorded at initialize.
    if (typeof tx.amount === "number") {
      expectedAmountKobo = tx.amount;
    }
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 502 });
  }

  const admin = createAdminClient();

  // Idempotent, same reasoning as markPurchaseSuccess: safe to call more
  // than once if the client retries.
  const { data: gift } = await admin
    .from("gifts")
    .select("*, artists(stage_name)")
    .eq("paystack_ref", reference)
    .single();

  if (!gift) {
    return NextResponse.json({ error: "Gift not found" }, { status: 404 });
  }

  if (typeof expectedAmountKobo === "number" && expectedAmountKobo < gift.amount_kobo) {
    console.error(
      `gift verify refused ${reference}: paid ${expectedAmountKobo} < recorded ${gift.amount_kobo}`,
    );
    return NextResponse.json({ error: "Payment amount mismatch" }, { status: 402 });
  }

  if (gift.status !== "success") {
    // Conditional so concurrent retries can't double-send the thank-you.
    const { data: updated } = await admin
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
  }

  return NextResponse.json({ status: "success" });
}
