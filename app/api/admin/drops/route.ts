import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENRES } from "@/lib/genres";
import type { Genre, ReleaseType } from "@/lib/types";
import { parseBody } from "@/lib/http";
import { splitLyrics } from "@/lib/lrc";

const genreValues = GENRES.map((g) => g.value) as [Genre, ...Genre[]];

const schema = z.object({
  artistId: z.string().uuid(),
  title: z.string().trim().min(1),
  description: z.string().trim().nullable(),
  releaseType: z.enum(["single", "ep", "album"]) as z.ZodType<ReleaseType>,
  genre: z.enum(genreValues),
  secondaryGenre: z.enum(genreValues).nullable(),
  status: z.enum(["draft", "published"]),
  minPriceNaira: z.number().positive(),
  artworkPath: z.string().trim().nullable(),
  isExclusive: z.boolean(),
  releaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => !Number.isNaN(new Date(`${s}T23:59:59`).getTime()))
    .nullable(),
  tracks: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        audioPath: z.string().trim().min(1),
        minPriceNaira: z.number().positive(),
        collaborators: z.string().trim().nullable(),
        lyrics: z.string().trim().nullable(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Every staged file must belong to the target artist's folder.
  const prefix = `${input.artistId}/`;
  const badPath =
    (input.artworkPath && !input.artworkPath.startsWith(prefix)) ||
    input.tracks.some((t) => !t.audioPath.startsWith(prefix));
  if (badPath) {
    return NextResponse.json({ error: "Invalid file paths." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", input.artistId)
    .eq("approval_status", "approved")
    .maybeSingle();
  if (!artist) {
    return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  }

  const releaseMinPriceKobo = Math.round(input.minPriceNaira * 100);
  const windowEnd =
    input.status === "published" && !input.isExclusive && input.releaseDate
      ? new Date(`${input.releaseDate}T23:59:59`).toISOString()
      : null;

  const { data: drop, error: dropError } = await supabase
    .from("drops")
    .insert({
      artist_id: input.artistId,
      title: input.title,
      description: input.description || null,
      release_type: input.releaseType,
      genre: input.genre,
      secondary_genre: input.secondaryGenre,
      status: input.status,
      min_price_kobo: releaseMinPriceKobo,
      artwork_path: input.artworkPath,
      window_end: windowEnd,
      is_exclusive: input.isExclusive,
    })
    .select("id")
    .single();
  if (dropError || !drop) {
    return NextResponse.json({ error: "Could not save the drop." }, { status: 500 });
  }

  const trackRows = input.tracks.map((t, i) => {
    const { lyrics, lyricsLrc } = splitLyrics(t.lyrics);
    return {
      drop_id: drop.id,
      track_number: i + 1,
      title: t.title,
      audio_file_path: t.audioPath,
      min_price_kobo: Math.round(t.minPriceNaira * 100),
      collaborators: t.collaborators || null,
      lyrics,
      lyrics_lrc: lyricsLrc,
    };
  });
  const { error: tracksError } = await supabase.from("drop_tracks").insert(trackRows);
  if (tracksError) {
    return NextResponse.json({ error: "Drop saved, but the tracklist failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dropId: drop.id });
}
