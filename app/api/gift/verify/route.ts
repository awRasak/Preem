import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction as verifyPaystackTransaction } from "@/lib/paystack";
import { verifyTransaction as verifySquadTransaction } from "@/lib/squad";
import { markGiftSuccess } from "@/lib/gifts";

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The gateway was already chosen by the geo-router at initialize, so this
  // reference has to be verified against THAT gateway -- a Squad gift can't be
  // confirmed by asking Paystack about it. An unknown reference falls back to
  // Paystack and keeps the previous behaviour (verify throws -> 502).
  const { data: giftRow } = await admin
    .from("gifts")
    .select("gateway")
    .eq("paystack_ref", reference)
    .maybeSingle();
  const gateway: string = giftRow?.gateway ?? "paystack";

  let expectedAmountKobo: number | undefined;

  try {
    const tx =
      gateway === "squad"
        ? await verifySquadTransaction(reference)
        : await verifyPaystackTransaction(reference);
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

  const gift = await markGiftSuccess(admin, reference, expectedAmountKobo);
  if (!gift) {
    return NextResponse.json({ error: "Gift not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "success" });
}
