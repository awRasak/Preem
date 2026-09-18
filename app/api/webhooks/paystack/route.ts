import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/paystack";
import { markPurchaseSuccess } from "@/lib/purchases";
import { markShowTicketSuccess } from "@/lib/show-tickets";

const FORWARD_URL = process.env.MOTOKA_WEBHOOK_FORWARD_URL;
const FORWARD_TIMEOUT_MS = 10_000;

function isPreemReference(ref: unknown): boolean {
  return (
    typeof ref === "string" &&
    (ref.startsWith("preem_") || ref.startsWith("payout_"))
  );
}

async function forwardToMotoka(rawBody: string, signature: string | null) {
  if (!FORWARD_URL) return;
  try {
    const res = await fetch(FORWARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-paystack-signature": signature } : {}),
      },
      body: rawBody,
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(
        `Motoka webhook forward failed: ${res.status} ${await res.text().catch(() => "")}`,
      );
    }
  } catch (err) {
    console.error("Motoka webhook forward error:", err);
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const reference: unknown = event.data?.reference;

  // One Paystack account serves both Preem and Motoka, but Paystack allows
  // only one webhook URL -- so Preem owns it and fans out. Anything that
  // isn't recognizably ours goes to Motoka byte-for-byte (raw body +
  // original signature, so Motoka verifies against the shared secret).
  if (!isPreemReference(reference)) {
    await forwardToMotoka(rawBody, signature);
    return NextResponse.json({ received: true, forwarded: true });
  }

  if (event.event === "charge.success") {
    const supabase = createAdminClient();
    // Fail closed if Paystack ever omits the collected amount: the verify
    // callback path re-checks independently, so skipping here is safe.
    const paidAmount =
      typeof event.data?.amount === "number" ? event.data.amount : undefined;
    // Either a drop purchase or a show ticket may carry this reference; the
    // mark helpers are both idempotent and no-op when the reference isn't
    // theirs, so it's safe to try both.
    await Promise.all([
      markPurchaseSuccess(supabase, event.data.reference, paidAmount),
      markShowTicketSuccess(supabase, event.data.reference, paidAmount),
    ]);
  }

  return NextResponse.json({ received: true });
}
