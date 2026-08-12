import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction as verifyPaystackTransaction } from "@/lib/paystack";
import { verifyTransaction as verifyMonipayTransaction } from "@/lib/monipay";
import { markPurchaseSuccess } from "@/lib/purchases";

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("purchases")
    .select("gateway")
    .eq("paystack_ref", reference)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  try {
    const tx =
      existing.gateway === "monipay"
        ? await verifyMonipayTransaction(reference)
        : await verifyPaystackTransaction(reference);
    if (tx.status !== "success") {
      return NextResponse.json({ status: tx.status });
    }
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 502 });
  }

  const purchase = await markPurchaseSuccess(supabase, reference);

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "success", fanPhone: purchase.fan_phone });
}
