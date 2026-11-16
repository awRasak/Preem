import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_CHECKOUT_KOBO } from "@/lib/minimum-price";
import { parseBody } from "@/lib/http";

const tierSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price_kobo: z.number().int().positive().max(10_000_000),
  quantity: z.number().int().positive().max(100_000),
  design: z.enum(["standard", "vip", "premium", "table", "backstage"]).default("standard"),
});

const schema = z.object({
  artistId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  venue: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }).optional().nullable(),
  sales_close_at: z.string().datetime({ offset: true }).optional().nullable(),
  ticket_price_kobo: z.number().int().positive().max(10_000_000),
  total_tickets: z.number().int().positive().max(100_000),
  cover_art_path: z.string().trim().max(400).optional().nullable(),
  tiers: z.array(tierSchema).optional(),
});

export async function POST(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const {
    artistId,
    title,
    description,
    venue,
    city,
    start_at,
    end_at,
    sales_close_at,
    ticket_price_kobo,
    total_tickets,
    cover_art_path,
  } = parsed.data;

  const start = new Date(start_at);
  if (!Number.isFinite(start.getTime())) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  const salesClose = sales_close_at ? new Date(sales_close_at) : null;
  if (salesClose && !Number.isFinite(salesClose.getTime())) {
    return NextResponse.json({ error: "Invalid sales close date" }, { status: 400 });
  }
  if (salesClose && salesClose.getTime() > start.getTime()) {
    return NextResponse.json(
      { error: "Sales must close at or before the show starts." },
      { status: 400 },
    );
  }

  // Every staged file must belong to the target artist's folder.
  if (cover_art_path && !cover_art_path.startsWith(`${artistId}/`)) {
    return NextResponse.json({ error: "Invalid cover art path." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", artistId)
    .eq("approval_status", "approved")
    .maybeSingle();
  if (!artist) {
    return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  }

  const tiers = parsed.data.tiers ?? [];
  // If tiers are provided, total capacity = sum of tier quantities,
  // and the show's legacy ticket_price_kobo = lowest tier price (for
  // display/fallback when no tiers are queried).
  const totalTickets = tiers.length > 0
    ? tiers.reduce((sum, t) => sum + t.quantity, 0)
    : total_tickets;
  const basePrice = tiers.length > 0
    ? Math.min(...tiers.map((t) => t.price_kobo))
    : ticket_price_kobo;

  const { data, error } = await supabase
    .from("shows")
    .insert({
      artist_id: artistId,
      title,
      description: description?.trim() ? description : null,
      venue: venue?.trim() ? venue : null,
      city: city?.trim() ? city : null,
      start_at: start.toISOString(),
      end_at: end_at ? new Date(end_at).toISOString() : null,
      sales_close_at: salesClose ? salesClose.toISOString() : null,
      ticket_price_kobo: basePrice,
      total_tickets: totalTickets,
      cover_art_path: cover_art_path ?? null,
      status: "published",
    })
    .select("id, slug, title")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not create event." }, { status: 500 });
  }

  // Insert tiers if provided.
  if (tiers.length > 0) {
    const tierRows = tiers.map((t, i) => ({
      show_id: data.id,
      name: t.name,
      price_kobo: t.price_kobo,
      quantity: t.quantity,
      design: t.design,
      sort_order: i,
    }));
    const { error: tierError } = await supabase.from("show_ticket_tiers").insert(tierRows);
    if (tierError) {
      // Roll back the show to avoid an orphan with no tiers.
      await supabase.from("shows").delete().eq("id", data.id);
      return NextResponse.json({ error: "Could not save ticket tiers." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, show: data });
}
