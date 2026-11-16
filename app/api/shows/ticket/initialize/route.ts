import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform-settings";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimitCheck, tooManyRequests } from "@/lib/rate-limit";
import { publicKeyForGateway, resolveGateway } from "@/lib/geo";
import { normalizePhone } from "@/lib/phone";
import { formatNaira } from "@/lib/format";
import { MIN_CHECKOUT_KOBO } from "@/lib/minimum-price";

const schema = z.object({
  showId: z.string().uuid(),
  tierId: z.string().uuid().optional().nullable(),
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
  const ipLimit = rateLimitCheck(`show-ticket-init:${clientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 20 });
  if (!ipLimit.allowed) {
    return tooManyRequests(ipLimit.retryAfterMs);
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { showId, tierId, amountKobo, fanName, fanEmail } = parsed.data;
  const fanPhone = normalizePhone(parsed.data.fanPhone);

  const supabase = createAdminClient();

  const settings = await getPlatformSettings(supabase);
  // Server-side geo-routing: Nigeria pays local (Monipay), everyone else
  // pays international (Squad). The client never chooses.
  const gateway = resolveGateway(req, settings);
  if (!gateway) {
    return NextResponse.json(
      { error: "Payments aren't available right now." },
      { status: 400 },
    );
  }

  // Basic existence/readable state before rate limiting the fan.
  const { data: show } = await supabase
    .from("shows")
    .select("id, ticket_price_kobo, total_tickets, start_at, sales_close_at, status")
    .eq("id", showId)
    .single();

  if (!show || show.status !== "published") {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  const salesCloseAt = new Date(show.sales_close_at ?? show.start_at).getTime();
  if (salesCloseAt <= Date.now()) {
    return NextResponse.json({ error: "Ticket sales for this show have closed." }, { status: 400 });
  }

  if (amountKobo < show.ticket_price_kobo) {
    return NextResponse.json(
      { error: "Amount is below the ticket price." },
      { status: 400 },
    );
  }

  if (amountKobo < MIN_CHECKOUT_KOBO) {
    return NextResponse.json(
      { error: `Minimum payment is ${formatNaira(MIN_CHECKOUT_KOBO)} — pick a higher amount.` },
      { status: 400 },
    );
  }

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count: recentAttempts } = await supabase
    .from("show_tickets")
    .select("id", { count: "exact", head: true })
    .eq("fan_phone", fanPhone)
    .gte("created_at", windowStart);

  if ((recentAttempts ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    // "Later" is when the oldest attempt in this window expires.
    const { data: oldest } = await supabase
      .from("show_tickets")
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

  const reference = `preem_tkt_${crypto.randomUUID()}`;

  // Atomic reservation (row-lock + capacity check inside the DB) so
  // concurrent checkouts can't oversell the last seats. See
  // 0036_show_sales_close_and_ticket_claim.sql.
  const { data: claim, error: claimError } = await supabase.rpc("create_show_ticket", {
    p_show_id: showId,
    p_tier_id: tierId ?? null,
    p_fan_name: fanName,
    p_fan_phone: fanPhone,
    p_fan_email: fanEmail,
    p_amount_kobo: amountKobo,
    p_paystack_ref: reference,
    p_gateway: gateway,
  });

  if (claimError) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  const row = (Array.isArray(claim) ? claim[0] : claim) as
    | { ticket_id: string | null; ticket_amount_kobo: number | null; ticket_tier_name: string | null; ticket_tier_design: string | null; error_code: string | null }
    | null;

  if (!row || row.error_code || !row.ticket_id) {
    const code = row?.error_code;
    if (code === "not_found") {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }
    if (code === "sales_closed") {
      return NextResponse.json({ error: "Ticket sales for this show have closed." }, { status: 400 });
    }
    if (code === "sold_out") {
      return NextResponse.json({ error: "This show is sold out." }, { status: 400 });
    }
    if (code === "under_price") {
      return NextResponse.json({ error: "Amount is below the ticket price." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  const ticketAmount = row.ticket_amount_kobo ?? show.ticket_price_kobo;

  // NOTE: no server-side Monipay /transaction/initialize -- the order must
  // be registered exactly ONCE, by the popup under our metadata reference.
  // Pre-registering here collides with the popup's creation ("Duplicate
  // transaction: order_id already exists"). See checkout/initialize.
  let accessCode: string | undefined;

  return NextResponse.json({
    reference,
    amountKobo: ticketAmount,
    gateway,
    accessCode,
    publicKey: publicKeyForGateway(gateway),
    tierName: row.ticket_tier_name ?? null,
    tierDesign: row.ticket_tier_design ?? "standard",
  });
}