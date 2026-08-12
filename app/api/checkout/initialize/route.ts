import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDropLive } from "@/lib/format";
import { getPlatformSettings } from "@/lib/platform-settings";

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
  gateway: z.enum(["paystack", "monipay"]).default("paystack"),
});

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { dropId, trackId, amountKobo, fanName, fanPhone, fanEmail, gateway } = parsed.data;

  const supabase = createAdminClient();

  const settings = await getPlatformSettings(supabase);
  const gatewayEnabled = gateway === "paystack" ? settings.paystackEnabled : settings.monipayEnabled;
  if (!gatewayEnabled) {
    return NextResponse.json(
      { error: "That payment method isn't available right now." },
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
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429 },
    );
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

  return NextResponse.json({
    reference,
    amountKobo,
    gateway,
    publicKey:
      gateway === "monipay"
        ? process.env.NEXT_PUBLIC_MONIPAY_PUBLIC_KEY
        : process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  });
}
