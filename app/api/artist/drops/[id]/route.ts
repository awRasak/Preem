import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GENRES } from "@/lib/genres";
import type { Genre } from "@/lib/types";
import { parseBody } from "@/lib/http";

const genreValues = GENRES.map((g) => g.value) as [Genre, ...Genre[]];
const genreSchema = z.enum(genreValues);

const trackSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  collaborators: z.string().trim().nullable(),
  lyrics: z.string().trim().nullable(),
  minPriceNaira: z.number().positive(),
});

const schema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().nullable(),
  genre: genreSchema,
  secondaryGenre: genreSchema.nullable(),
  artworkPath: z.string().nullable().optional(),
  minPriceNaira: z.number().positive(),
  isExclusive: z.boolean(),
  // Must be a bare YYYY-MM-DD date -- it's concatenated with a time and
  // parsed below, and an unparseable value would throw on toISOString().
  releaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => !Number.isNaN(new Date(`${s}T23:59:59`).getTime()))
    .nullable(),
  tracks: z.array(trackSchema).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const { id } = await params;
  const { data: drop } = await supabase
    .from("drops")
    .select("id, artist_id, min_price_kobo, is_exclusive, window_end")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();
  if (!drop) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }

  const { count: salesCount } = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("drop_id", id)
    .eq("status", "success");
  const hasSales = (salesCount ?? 0) > 0;

  // Price and drop type/window are locked once someone has paid — an artist
  // can't retroactively undercut a buyer or change what they thought they
  // bought. Every other field (title, description, artwork, genre) stays
  // editable regardless of sales. If a request tries to change a locked
  // field anyway (e.g. a stale client), we silently keep the current value
  // rather than erroring, since the UI already disables those inputs.
  const minPriceKobo = hasSales
    ? drop.min_price_kobo
    : Math.round(input.minPriceNaira * 100);
  const isExclusive = hasSales ? drop.is_exclusive : input.isExclusive;
  const windowEnd = hasSales
    ? drop.window_end
    : isExclusive
      ? null
      : input.releaseDate
        ? new Date(`${input.releaseDate}T23:59:59`).toISOString()
        : null;

  const { error: dropError } = await supabase
    .from("drops")
    .update({
      title: input.title,
      description: input.description || null,
      genre: input.genre,
      secondary_genre: input.secondaryGenre,
      artwork_path: input.artworkPath,
      min_price_kobo: minPriceKobo,
      is_exclusive: isExclusive,
      window_end: windowEnd,
    })
    .eq("id", id)
    .eq("artist_id", user.id);

  if (dropError) {
    return NextResponse.json({ error: "Could not save changes." }, { status: 500 });
  }

  for (const track of input.tracks ?? []) {
    const { error: trackError } = await supabase
      .from("drop_tracks")
      .update({
        title: track.title,
        collaborators: track.collaborators || null,
        lyrics: track.lyrics || null,
        min_price_kobo: hasSales
          ? undefined
          : Math.round(track.minPriceNaira * 100),
      })
      .eq("id", track.id)
      .eq("drop_id", id);
    if (trackError) {
      return NextResponse.json({ error: "Could not save track changes." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, hasSales });
}
