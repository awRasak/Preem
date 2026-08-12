import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  artistId: z.string().uuid(),
  amountKobo: z.number().int().positive(),
  fanName: z.string().trim().min(1).max(120),
  fanEmail: z.string().trim().email().optional(),
});

// No minimum tied to any drop's price -- gifts are a separate transaction
// type entirely. This floor exists only so a Paystack transaction fee can
// never exceed the gift itself, not as a pricing decision.
const MIN_GIFT_KOBO = 10000; // ₦100

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { artistId, amountKobo, fanName } = parsed.data;

  if (amountKobo < MIN_GIFT_KOBO) {
    return NextResponse.json(
      { error: "Enter at least ₦100." },
      { status: 400 },
    );
  }

  // A signed-in fan's verified email is used regardless of what the client
  // sent -- never trust a client-supplied email over a session we already
  // verified via OTP.
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const fanEmail = sessionUser?.email ?? parsed.data.fanEmail;
  if (!fanEmail) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: artist } = await admin
    .from("artists")
    .select("id, approval_status")
    .eq("id", artistId)
    .single();

  if (!artist || artist.approval_status !== "approved") {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count } = await admin
    .from("gifts")
    .select("id", { count: "exact", head: true })
    .eq("fan_email", fanEmail)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429 },
    );
  }

  // Vercel's edge injects these on every incoming request in production;
  // absent in local dev, which is fine -- location is "where available".
  const city = req.headers.get("x-vercel-ip-city");
  const country = req.headers.get("x-vercel-ip-country");
  const fanLocation = city && country ? `${decodeURIComponent(city)}, ${country}` : country || null;

  const reference = `gift_${crypto.randomUUID()}`;

  const { error: insertError } = await admin.from("gifts").insert({
    artist_id: artistId,
    fan_name: fanName,
    fan_email: fanEmail,
    fan_location: fanLocation,
    fan_user_id: sessionUser?.id ?? null,
    amount_kobo: amountKobo,
    paystack_ref: reference,
    status: "pending",
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not start gift." }, { status: 500 });
  }

  return NextResponse.json({
    reference,
    amountKobo,
    fanEmail,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  });
}
