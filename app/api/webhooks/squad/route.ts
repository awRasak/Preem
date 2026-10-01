import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction as verifySquadTransaction, verifyWebhookSignature } from "@/lib/squad";
import { markPurchaseSuccess } from "@/lib/purchases";
import { markShowTicketSuccess } from "@/lib/show-tickets";
import { markGiftSuccess } from "@/lib/gifts";

// POST https://preem.ng/api/webhooks/squad
// (paste this URL into Squad's dashboard webhook setting).
//
// Server-side safety net for Squad payments: if the buyer closes the tab
// before the widget's onSuccess handler runs /api/checkout/verify, this is
// what still grants access.
//
// Trust model, in two independent layers:
//  1. The body must carry Squad's HMAC-SHA512 signature (x-squad-encrypted-body)
//     -- that stops anonymous traffic from costing us outbound verify calls.
//  2. The event is treated as a *trigger* only: TransactionRef is re-verified
//     live against Squad's API with the secret key, and the row is marked
//     only on a "success" response whose gross amount covers the recorded
//     price. A forged-but-correctly-signed event still verifies-fail and
//     marks nothing.
// Every mark helper is idempotent, so retries and double-delivery (widget
// callback + webhook) are safe.
export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, req.headers.get("x-squad-encrypted-body"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    Event?: unknown;
    TransactionRef?: unknown;
    Amount?: unknown;
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = typeof event.Event === "string" ? event.Event : "unknown";
  // Account-linked / transfer / payout events share this endpoint with the
  // card & transfer charges this repo actually cares about.
  if (eventName !== "charge_successful") {
    return NextResponse.json({ received: true, ignored: eventName });
  }

  const reference = typeof event.TransactionRef === "string" ? event.TransactionRef : "";
  if (!reference) {
    return NextResponse.json({ error: "Missing TransactionRef" }, { status: 400 });
  }

  try {
    const tx = await verifySquadTransaction(reference);
    if (tx.status !== "success") {
      return NextResponse.json({ received: true, verified: tx.status });
    }
    // transaction_amount is gross, which is exactly what the mark helpers
    // compare against the price recorded at initialize.
    const paidAmount = typeof tx.amount === "number" ? tx.amount : undefined;

    const supabase = createAdminClient();
    const [purchase, ticket, gift] = await Promise.all([
      markPurchaseSuccess(supabase, reference, paidAmount),
      markShowTicketSuccess(supabase, reference, paidAmount),
      markGiftSuccess(supabase, reference, paidAmount),
    ]);
    const matched =
      (purchase && purchase.status === "success") ||
      (ticket && ticket.status === "success") ||
      (gift && gift.status === "success");
    if (matched) {
      console.log(`squad webhook: matched ${reference}`);
      return NextResponse.json({ received: true, matched: true });
    }
    // Not one of our pending rows (or the amount guard refused it).
    return NextResponse.json({ received: true, matched: false });
  } catch (e) {
    console.error(
      `squad webhook verify threw for ${reference}:`,
      e instanceof Error ? e.message : e,
    );
    // Tell Squad we did not process it so it retries.
    return NextResponse.json({ error: "Verification failed" }, { status: 502 });
  }
}
