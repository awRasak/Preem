import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction as verifyPaystackTransaction } from "@/lib/paystack";
import { verifyTransaction as verifyMonipayTransaction, monipayCollected } from "@/lib/monipay";
import { verifyTransaction as verifySquadTransaction } from "@/lib/squad";
import { markPurchaseSuccess } from "@/lib/purchases";
import { markShowTicketSuccess } from "@/lib/show-tickets";
import { markMerchOrderSuccess } from "@/lib/merch";

// One verify endpoint for drops, show tickets, and merch -- all mint pending
// rows keyed by reference before payment, so the flow is identical.
export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const [{ data: purchase }, { data: showTicket }, { data: merchOrder }] = await Promise.all([
    supabase
      .from("purchases")
      .select("gateway, amount_kobo, fan_phone, fan_email, fan_name")
      .eq("paystack_ref", reference)
      .single(),
    supabase
      .from("show_tickets")
      .select("gateway, amount_kobo, fan_phone, fan_email, fan_name")
      .eq("paystack_ref", reference)
      .single(),
    supabase
      .from("merch_orders")
      .select("gateway, amount_kobo, fan_phone, fan_email, fan_name")
      .eq("paystack_ref", reference)
      .single(),
  ]);

  const existing = purchase ?? showTicket ?? merchOrder;
  if (!existing) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  try {
    // Squad reports "Success"/"Failed"/"Abandoned" capitalized; lib/squad
    // normalizes it to lowercase before this check.
    const tx =
      existing.gateway === "monipay"
        ? await verifyMonipayTransaction(reference)
        : existing.gateway === "squad"
          ? await verifySquadTransaction(reference)
          : await verifyPaystackTransaction(reference);
    if (tx.status !== "success") {
      return NextResponse.json({ status: tx.status });
    }
    // The gateway must have collected at least the committed price before
    // access is granted (guards against a tampered inline popup amount).
    // Monipay reports net of fees, so compare the gross collected -- Paystack
    // and Squad both report gross already.
    const collected =
      existing.gateway === "monipay" ? monipayCollected(tx) : tx.amount;
    if (typeof collected === "number" && collected < existing.amount_kobo) {
      console.error(
        `verify refused ${reference}: collected ${collected} < recorded ${existing.amount_kobo}`,
      );
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 402 });
    }
  } catch (e) {
    console.error(`verify threw for ${reference}:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Verification failed" }, { status: 502 });
  }

  const confirmed = purchase
    ? await markPurchaseSuccess(supabase, reference)
    : showTicket
      ? await markShowTicketSuccess(supabase, reference)
      : await markMerchOrderSuccess(supabase, reference);

  if (!confirmed || confirmed.status !== "success") {
    return NextResponse.json(
      { error: "Purchase could not be confirmed" },
      { status: 402 },
    );
  }

  return NextResponse.json({
    status: "success",
    oversold: "oversold" in confirmed ? confirmed.oversold : false,
    fanPhone: "fan_phone" in confirmed ? confirmed.fan_phone : undefined,
  });
}