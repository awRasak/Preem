import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_CHECKOUT_KOBO } from "@/lib/minimum-price";
import { parseBody } from "@/lib/http";

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

  if (ticket_price_kobo < MIN_CHECKOUT_KOBO) {
    return NextResponse.json(
      { error: "Ticket price must be at least ₦50." },
      { status: 400 },
    );
  }

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
      ticket_price_kobo,
      total_tickets,
      cover_art_path: cover_art_path ?? null,
      status: "published",
    })
    .select("id, slug, title")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not create event." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, show: data });
}
