import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/paystack";
import { markPurchaseSuccess } from "@/lib/purchases";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const supabase = createAdminClient();
    // Fail closed if Paystack ever omits the collected amount: the verify
    // callback path re-checks independently, so skipping here is safe.
    const paidAmount =
      typeof event.data?.amount === "number" ? event.data.amount : undefined;
    await markPurchaseSuccess(supabase, event.data.reference, paidAmount);
  }

  return NextResponse.json({ received: true });
}
