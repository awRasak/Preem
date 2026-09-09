import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";
import { markGiftSuccess } from "@/lib/gifts";

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
  const gift = await markGiftSuccess(admin, reference, expectedAmountKobo);
  if (!gift) {
    return NextResponse.json({ error: "Gift not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "success" });
}
