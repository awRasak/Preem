import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import {
  verifyTransaction as verifyMonipayTransaction,
  monipayCandidateRefs,
  monipayCollected,
} from "@/lib/monipay";
import { markPurchaseSuccess } from "@/lib/purchases";
import { markShowTicketSuccess } from "@/lib/show-tickets";
import { markGiftSuccess } from "@/lib/gifts";

// Confirms a Monipay payment using the reference Monipay itself reports.
//
// Why this exists instead of reusing /api/checkout/verify: Monipay's inline
// popup (see js.monipay.ng/v2/inline.js) forwards only public_key, email and
// amount to its checkout page -- it silently drops our client-supplied
// reference AND the initialize access_code. So the completed payment lives
// under Monipay's own internal reference and verify/{ourReference} always
// 404s with "Transaction not found". The MONIPAY_SUCCESS postMessage payload
// carries Monipay's canonical reference; the frontend forwards it here as
// `payload`, we verify it directly, amount-guard it, and mark OUR pending
// row (looked up by `reference`) confirmed.
const schema = z.object({
  reference: z.string().min(1),
  payload: z.unknown(),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { reference, payload } = parsed.data;

  const supabase = createAdminClient();

  const [{ data: purchase }, { data: showTicket }, { data: gift }] = await Promise.all([
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
      .from("gifts")
      .select("gateway, amount_kobo, fan_phone, fan_email, fan_name")
      .eq("paystack_ref", reference)
      .single(),
  ]);

  const existing = purchase ?? showTicket ?? gift;
  if (!existing) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }
  if (existing.gateway !== "monipay") {
    return NextResponse.json(
      { error: "Not a Monipay purchase" },
      { status: 400 },
    );
  }

  // Our own reference first (in case Monipay ever honors the registration),
  // then whatever references the popup payload carries.
  const attempts = [reference, ...monipayCandidateRefs(payload)];

  for (const candidate of attempts) {
    try {
      const tx = await verifyMonipayTransaction(candidate);
      if (tx.status !== "success") continue;
      // Same tamper guard as /api/checkout/verify, but against the GROSS
      // collected: Monipay's amount is net of fees.
      const collected = monipayCollected(tx);
      if (collected < existing.amount_kobo) {
        console.error(
          `verify-monipay refused ${reference}: collected ${collected} < recorded ${existing.amount_kobo}`,
        );
        return NextResponse.json(
          { error: "Payment amount mismatch" },
          { status: 402 },
        );
      }
      const confirmed = purchase
        ? await markPurchaseSuccess(supabase, reference, collected)
        : showTicket
          ? await markShowTicketSuccess(supabase, reference, collected)
          : await markGiftSuccess(supabase, reference, collected);
      if (confirmed && confirmed.status === "success") {
        return NextResponse.json({
          status: "success",
          fanPhone: "fan_phone" in confirmed ? confirmed.fan_phone : undefined,
        });
      }
      return NextResponse.json(
        { error: "Purchase could not be confirmed" },
        { status: 402 },
      );
    } catch (e) {
      console.error(
        `verify-monipay threw for ${reference} (candidate ${candidate.slice(0, 24)}):`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 502 });
}
