import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDropLive } from "@/lib/format";
import { getPlatformSettings } from "@/lib/platform-settings";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimitCheck, tooManyRequests } from "@/lib/rate-limit";
import { countryFromRequest, gatewayForCountry } from "@/lib/geo";
import { initializeTransaction as initializeMonipayTransaction } from "@/lib/monipay";

const schema = z.object({
  dropId: z.string().uuid(),
  trackId: z.string().uuid().optional(),
  amountKobo: z.number().int().positive(),
  fanName: z.string().trim().min(1).max(120),
  fanPhone: z
    .string()
    .trim()
    .regex(/^[0-9+][0-9\s-]{6,19}$/, "Enter a valid phone number"),
  fanEmail: z.string().trim().email(),
});

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  // IP-level backstop on top of the per-phone limit below: pending rows are
  // created before any payment happens, so unthrottled this endpoint is a
  // free DB write (and lets one actor lock out a victim phone's checkout
  // quota).
  const ipLimit = rateLimitCheck(`checkout-init:${clientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 20 });
  if (!ipLimit.allowed) {
    return tooManyRequests(ipLimit.retryAfterMs);
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { dropId, trackId, amountKobo, fanName, fanPhone, fanEmail } = parsed.data;

  const supabase = createAdminClient();

  const settings = await getPlatformSettings(supabase);
  // The server picks the gateway from the buyer's country -- Nigeria pays
  // local (Monipay), everyone else pays international (Paystack). The client
  // never chooses.
  const gateway = gatewayForCountry(countryFromRequest(req), settings);
  if (!gateway) {
    return NextResponse.json(
      { error: "Payments aren't available right now." },
      { status: 400 },
    );
  }

  const { data: drop } = await supabase
    .from("drops")
    .select("id, min_price_kobo, window_end, status, title")
    .eq("id", dropId)
    .single();

  if (!drop || drop.status !== "published") {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }
  if (!isDropLive(drop.window_end)) {
    return NextResponse.json(
      { error: "This drop's early-access window has closed." },
      { status: 400 },
    );
  }

  let minPriceKobo = drop.min_price_kobo;
  if (trackId) {
    const { data: track } = await supabase
      .from("drop_tracks")
      .select("id, drop_id, min_price_kobo")
      .eq("id", trackId)
      .single();
    if (!track || track.drop_id !== dropId) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }
    minPriceKobo = track.min_price_kobo;
  }

  if (amountKobo < minPriceKobo) {
    return NextResponse.json(
      { error: "Amount is below the minimum price." },
      { status: 400 },
    );
  }

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count } = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("fan_phone", fanPhone)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    // "Later" is when the oldest attempt in this window expires.
    const { data: oldest } = await supabase
      .from("purchases")
      .select("created_at")
      .eq("fan_phone", fanPhone)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const retryAfterMs = oldest
      ? Math.max(
          0,
          new Date(oldest.created_at).getTime() +
            RATE_LIMIT_WINDOW_MINUTES * 60 * 1000 -
            Date.now(),
        )
      : RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    return tooManyRequests(retryAfterMs);
  }

  const reference = `preem_${crypto.randomUUID()}`;

  const { error: insertError } = await supabase.from("purchases").insert({
    drop_id: dropId,
    track_id: trackId ?? null,
    fan_name: fanName,
    fan_phone: fanPhone,
    fan_email: fanEmail,
    amount_kobo: amountKobo,
    paystack_ref: reference,
    status: "pending",
    gateway,
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 },
    );
  }

  // Monipay only recognizes our reference for later verification if it was
  // registered through this call first -- see initializeTransaction's
  // comment in lib/monipay.ts. Paystack's Inline JS has no such requirement.
  let accessCode: string | undefined;
  if (gateway === "monipay") {
    try {
      const monipayTx = await initializeMonipayTransaction({
        email: fanEmail,
        amountKobo,
        reference,
      });
      accessCode = monipayTx.access_code;
    } catch (e) {
      console.error(`monipay initialize failed for ${reference}:`, e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "Could not start checkout." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    reference,
    amountKobo,
    gateway,
    accessCode,
    publicKey:
      gateway === "monipay"
        ? process.env.NEXT_PUBLIC_MONIPAY_PUBLIC_KEY
        : process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  });
}
