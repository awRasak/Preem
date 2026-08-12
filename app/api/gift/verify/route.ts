import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";
import { sendGiftThankYouEmail } from "@/lib/email";

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") {
      return NextResponse.json({ status: tx.status });
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

  if (gift.status !== "success") {
    await admin
      .from("gifts")
      .update({ status: "success", paid_at: new Date().toISOString() })
      .eq("id", gift.id);

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

  return NextResponse.json({ status: "success" });
}
