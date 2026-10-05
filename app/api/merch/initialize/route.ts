import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform-settings";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimitCheck, tooManyRequests } from "@/lib/rate-limit";
import { publicKeyForGateway, resolveGateway } from "@/lib/geo";
import { normalizePhone } from "@/lib/phone";

const schema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).default(1),
  zoneId: z.string().uuid(),
  amountKobo: z.number().int().positive(),
  fanName: z.string().trim().min(1).max(120),
  fanPhone: z
    .string()
    .trim()
    .regex(/^[0-9+][0-9\s-]{6,19}$/, "Enter a valid phone number"),
  fanEmail: z.string().trim().email(),
  address: z.string().trim().min(5).max(500),
});

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  const ipLimit = rateLimitCheck(`merch-init:${clientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 20 });
  if (!ipLimit.allowed) {
    return tooManyRequests(ipLimit.retryAfterMs);
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { itemId, quantity, zoneId, amountKobo, fanName, fanEmail, address } = parsed.data;
  const fanPhone = normalizePhone(parsed.data.fanPhone);

  const supabase = createAdminClient();

  const settings = await getPlatformSettings(supabase);
  // Same geo-routing as every other product: Nigeria local (Monipay),
  // everyone else international (Squad). The client never chooses.
  const gateway = resolveGateway(req, settings);
  if (!gateway) {
    return NextResponse.json(
      { error: "Payments aren't available right now." },
      { status: 400 },
    );
  }

  const [{ data: item }, { data: zone }] = await Promise.all([
    supabase
      .from("merch_items")
      .select("id, title, price_kobo, stock, status")
      .eq("id", itemId)
      .single(),
    supabase
      .from("delivery_zones")
      .select("id, label, fee_kobo")
      .eq("id", zoneId)
      .single(),
  ]);

  if (!item || item.status !== "published") {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (!zone) {
    return NextResponse.json({ error: "Pick a delivery zone." }, { status: 400 });
  }
  if (item.stock < quantity) {
    return NextResponse.json(
      { error: item.stock <= 0 ? "Sold out." : `Only ${item.stock} left.` },
      { status: 400 },
    );
  }

  // Fixed merch pricing (no pay-what-you-want on physical goods): the fan
  // covers quantity x price plus the zone's flat per-order delivery fee.
  const totalKobo = quantity * item.price_kobo + zone.fee_kobo;
  if (amountKobo < totalKobo) {
    return NextResponse.json(
      { error: "Amount is below the total price." },
      { status: 400 },
    );
  }

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count } = await supabase
    .from("merch_orders")
    .select("id", { count: "exact", head: true })
    .eq("fan_phone", fanPhone)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    const { data: oldest } = await supabase
      .from("merch_orders")
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

  const reference = `preem_mrch_${crypto.randomUUID()}`;

  const { error: insertError } = await supabase.from("merch_orders").insert({
    item_id: itemId,
    fan_name: fanName,
    fan_phone: fanPhone,
    fan_email: fanEmail,
    address,
    zone_id: zone.id,
    zone_label: zone.label,
    quantity,
    item_price_kobo: item.price_kobo,
    delivery_fee_kobo: zone.fee_kobo,
    amount_kobo: totalKobo,
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

  // NOTE: no server-side gateway /transaction/initialize -- the popup
  // registers the order exactly once under our metadata reference (see
  // checkout/initialize). Pre-registering collides with "Duplicate
  // transaction: order_id already exists".
  let accessCode: string | undefined;

  return NextResponse.json({
    reference,
    amountKobo: totalKobo,
    gateway,
    accessCode,
    publicKey: publicKeyForGateway(gateway),
  });
}
