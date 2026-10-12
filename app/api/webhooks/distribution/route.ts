import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Tunearo signed webhooks (release.submitted/approved/rejected/live and
// friends) -> distribution_jobs status. Signature: HMAC-SHA256 of the raw
// body with the webhook secret, in X-Tunearo-Signature.
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TUNEARO_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const hash = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

const EVENT_STATUS: Record<string, string> = {
  "release.submitted": "submitted",
  "release.approved": "submitted",
  "release.rejected": "rejected",
  "release.live": "live",
  "release.takedown_completed": "failed",
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers.get("x-tunearo-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; event?: string; data?: { id?: string; release_id?: string; rejection_reason?: string; upc?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }
  const kind = event.type ?? event.event ?? "";
  const status = EVENT_STATUS[kind];
  const externalId = event.data?.id ?? event.data?.release_id;
  if (!status || !externalId) {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "live") patch.live_at = new Date().toISOString();
  if (status === "rejected") patch.rejection_reason = event.data?.rejection_reason ?? null;
  if (event.data?.upc) patch.upc = event.data.upc;
  await admin.from("distribution_jobs").update(patch).eq("external_id", externalId);

  return NextResponse.json({ received: true });
}
