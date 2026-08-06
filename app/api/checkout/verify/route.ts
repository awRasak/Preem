import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";
import { markPurchaseSuccess } from "@/lib/purchases";

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

  const supabase = createAdminClient();
  const purchase = await markPurchaseSuccess(supabase, reference);

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "success", fanPhone: purchase.fan_phone });
}
