import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
// MIN_CHECKOUT_KOBO no longer needed - tiers handle pricing
import { parseBody } from "@/lib/http";

const tierSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price_kobo: z.number().int().positive().max(10_000_000),
  quantity: z.number().int().positive().max(100_000),
  design: z.enum(["standard", "vip", "premium", "table", "backstage"]).default("standard"),
  design_image_path: z.string().trim().max(500).optional().nullable(),
});

const timeSchema = z.object({
  label: z.string().trim().min(1).max(60),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }).optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
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
  ticket_price_kobo: z.number().int().positive().max(10_000_000).optional(),
  total_tickets: z.number().int().positive().max(100_000).optional(),
  cover_art_path: z.string().trim().max(400).optional().nullable(),
  tiers: z.array(tierSchema).min(1, "At least one ticket tier is required."),
  times: z.array(timeSchema).optional(),
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

  // Admin is trusted; cover_art_path may be a storage path or a full URL.
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

  const tiers = parsed.data.tiers;
  const times = parsed.data.times ?? [];
  // Capacity and base price come from tiers (tiers are required).
  const totalTickets = tiers.reduce((sum, t) => sum + t.quantity, 0);
  const basePrice = Math.min(...tiers.map((t) => t.price_kobo));

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

  // Insert tiers.
  const tierRows = tiers.map((t, i) => ({
    show_id: data.id,
    name: t.name,
    price_kobo: t.price_kobo,
    quantity: t.quantity,
    design: t.design,
    design_image_path: t.design_image_path ?? null,
    sort_order: i,
  }));
  const { error: tierError } = await supabase.from("show_ticket_tiers").insert(tierRows);
  if (tierError) {
    await supabase.from("shows").delete().eq("id", data.id);
    return NextResponse.json({ error: "Could not save ticket tiers." }, { status: 500 });
  }

  // Insert schedule times.
  if (times.length > 0) {
    const timeRows = times.map((t, i) => ({
      show_id: data.id,
      label: t.label,
      start_at: t.start_at,
      end_at: t.end_at ?? null,
      sort_order: t.sort_order ?? i,
    }));
    const { error: timeError } = await supabase.from("show_times").insert(timeRows);
    if (timeError) {
      console.error("Could not save show times:", timeError.message);
    }
  }

  return NextResponse.json({ ok: true, show: data });
}
