import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction as verifyPaystackTransaction } from "@/lib/paystack";
import { verifyTransaction as verifyMonipayTransaction, monipayCollected } from "@/lib/monipay";
import { markPurchaseSuccess } from "@/lib/purchases";
import { markShowTicketSuccess } from "@/lib/show-tickets";

// One verify endpoint for both drops and show tickets -- both mint pending
// rows keyed by reference before payment, so the flow is identical.
export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const [{ data: purchase }, { data: showTicket }] = await Promise.all([
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
  ]);

  const existing = purchase ?? showTicket;
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
    // The gateway must have collected at least the committed price before
    // access is granted (guards against a tampered inline popup amount).
    // Monipay reports net of fees, so compare the gross collected.
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
    : await markShowTicketSuccess(supabase, reference);

  if (!confirmed || confirmed.status !== "success") {
    return NextResponse.json(
      { error: "Purchase could not be confirmed" },
      { status: 402 },
    );
  }

  return NextResponse.json({
    status: "success",
    fanPhone: "fan_phone" in confirmed ? confirmed.fan_phone : undefined,
  });
}