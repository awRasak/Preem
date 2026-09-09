import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  venue: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }).optional().nullable(),
  ticket_price_kobo: z.number().int().positive().max(10_000_000),
  total_tickets: z.number().int().positive().max(100_000),
  cover_art_path: z.string().trim().max(400).optional().nullable(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { title, description, venue, city, start_at, end_at, ticket_price_kobo, total_tickets, cover_art_path } =
    parsed.data;

  const { data: artist } = await supabase
    .from("artists")
    .select("approval_status")
    .eq("id", user.id)
    .single();

  if (!artist || artist.approval_status !== "approved") {
    return NextResponse.json({ error: "Artists can't list shows until approved." }, { status: 403 });
  }

  const start = new Date(start_at);
  if (!Number.isFinite(start.getTime())) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shows")
    .insert({
      artist_id: user.id,
      title,
      description: description?.trim() ? description : null,
      venue: venue?.trim() ? venue : null,
      city: city?.trim() ? city : null,
      start_at: start.toISOString(),
      end_at: end_at ? new Date(end_at).toISOString() : null,
      ticket_price_kobo,
      total_tickets,
      cover_art_path: cover_art_path ?? null,
      status: "published",
    })
    .select("slug, title, start_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not create show" }, { status: 500 });
  }

  return NextResponse.json({ show: data }, { status: 201 });
}