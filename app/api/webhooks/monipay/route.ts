import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyTransaction as verifyMonipayTransaction,
  monipayCandidateRefs,
} from "@/lib/monipay";
import { markPurchaseSuccess } from "@/lib/purchases";
import { markShowTicketSuccess } from "@/lib/show-tickets";

// POST https://preem.ng/api/webhooks/monipay
// (paste this URL into the Monipay dashboard webhook setting).
//
// Server-side safety net for Monipay payments: the popup confirms under
// Monipay's own reference, so if the buyer closes the tab before the
// frontend callback runs, this is what still grants access.
//
// Trust model: Monipay's webhook signing is undocumented, so this endpoint
// does NOT rely on it. Instead the event is treated as a *trigger* only --
// every candidate reference in the payload is re-verified live against
// Monipay's API (secret key) and a row is marked only on a success response
// whose amount covers the recorded price. Forged events verify-fail and
// mark nothing. Both mark helpers are idempotent, so retries and
// double-delivery (popup callback + webhook) are safe.
export async function POST(req: Request) {
  const rawBody = await req.text();
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const eventName =
    event && typeof event === "object" && "event" in event
      ? String((event as Record<string, unknown>).event)
      : "unknown";
  const data =
    event && typeof event === "object"
      ? ((event as Record<string, unknown>).data ?? event)
      : null;

  const candidates = monipayCandidateRefs(event);
  // Our own reference may arrive inside metadata (the checkout call sends
  // metadata.reference) -- match the row through it when present.
  const metaRef =
    data && typeof data === "object"
      ? (data as Record<string, unknown>).metadata
      : null;
  const ourRef =
    metaRef && typeof metaRef === "object"
      ? (metaRef as Record<string, unknown>).reference
      : null;

  let matched: string | null = null;
  for (const candidate of candidates) {
    try {
      const tx = await verifyMonipayTransaction(candidate);
      if (tx.status !== "success") continue;
      const paidAmount =
        typeof tx.amount === "number" ? tx.amount : undefined;
      // The completed payment may be addressable by Monipay's reference or
      // by our own (registration honored) -- the mark helpers no-op when the
      // reference isn't theirs, so trying both plus the metadata row is safe.
      const targets = [candidate];
      if (typeof ourRef === "string" && ourRef.length >= 4) targets.push(ourRef);
      for (const target of targets) {
        const [purchase, ticket] = await Promise.all([
          markPurchaseSuccess(supabase, target, paidAmount),
          markShowTicketSuccess(supabase, target, paidAmount),
        ]);
        if (
          (purchase && purchase.status === "success") ||
          (ticket && ticket.status === "success")
        ) {
          matched = target;
          break;
        }
      }
      if (matched) break;
    } catch (e) {
      console.error(
        `monipay webhook verify threw (candidate ${candidate.slice(0, 24)}):`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log(
    `monipay webhook: event=${eventName} candidates=${candidates.length} matched=${matched ?? "none"}`,
  );
  return NextResponse.json({ received: true });
}
