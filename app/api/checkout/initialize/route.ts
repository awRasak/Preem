import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDropLive } from "@/lib/format";

const schema = z.object({
  dropId: z.string().uuid(),
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
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { dropId, fanName, fanPhone, fanEmail } = parsed.data;

  const supabase = createAdminClient();

  const { data: drop } = await supabase
    .from("drops")
    .select("id, price_kobo, window_end, title")
    .eq("id", dropId)
    .single();

  if (!drop) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }
  if (!isDropLive(drop.window_end)) {
    return NextResponse.json(
      { error: "This drop's early-access window has closed." },
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
    fan_name: fanName,
    fan_phone: fanPhone,
    fan_email: fanEmail,
    amount_kobo: drop.price_kobo,
    paystack_ref: reference,
    status: "pending",
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    reference,
    amountKobo: drop.price_kobo,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  });
}
