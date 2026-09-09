import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform-settings";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { initializeTransaction as initializeMonipayTransaction } from "@/lib/monipay";

const schema = z.object({
  showId: z.string().uuid(),
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
  if (!rateLimit(`show-ticket-init:${clientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 20 })) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429 },
    );
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { showId, amountKobo, fanName, fanPhone, fanEmail, gateway } = parsed.data;

  const supabase = createAdminClient();

  const settings = await getPlatformSettings(supabase);
  const gatewayEnabled = gateway === "paystack" ? settings.paystackEnabled : settings.monipayEnabled;
  if (!gatewayEnabled) {
    return NextResponse.json(
      { error: "That payment method isn't available right now." },
      { status: 400 },
    );
  }

  const { data: show } = await supabase
    .from("shows")
    .select("id, ticket_price_kobo, total_tickets, start_at, status")
    .eq("id", showId)
    .single();

  if (!show || show.status !== "published") {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  // Tickets stop selling once the doors are about to open.
  if (new Date(show.start_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Ticket sales for this show have closed." }, { status: 400 });
  }

  if (amountKobo < show.ticket_price_kobo) {
    return NextResponse.json(
      { error: "Amount is below the ticket price." },
      { status: 400 },
    );
  }

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const [{ count: ticketsSold }, { count: recentAttempts }] = await Promise.all([
    supabase
      .from("show_tickets")
      .select("id", { count: "exact", head: true })
      .eq("show_id", showId)
      .eq("status", "success"),
    supabase
      .from("show_tickets")
      .select("id", { count: "exact", head: true })
      .eq("fan_phone", fanPhone)
      .gte("created_at", windowStart),
  ]);

  if ((ticketsSold ?? 0) >= show.total_tickets) {
    return NextResponse.json({ error: "This show is sold out." }, { status: 400 });
  }
  if ((recentAttempts ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429 },
    );
  }

  const reference = `preem_tkt_${crypto.randomUUID()}`;

  const { error: insertError } = await supabase.from("show_tickets").insert({
    show_id: showId,
    fan_name: fanName,
    fan_phone: fanPhone,
    fan_email: fanEmail,
    amount_kobo: show.ticket_price_kobo,
    paystack_ref: reference,
    status: "pending",
    gateway,
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  let accessCode: string | undefined;
  if (gateway === "monipay") {
    try {
      const monipayTx = await initializeMonipayTransaction({
        email: fanEmail,
        amountKobo: show.ticket_price_kobo,
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
    amountKobo: show.ticket_price_kobo,
    gateway,
    accessCode,
    publicKey:
      gateway === "monipay"
        ? process.env.NEXT_PUBLIC_MONIPAY_PUBLIC_KEY
        : process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  });
}