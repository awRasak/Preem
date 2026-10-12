import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import { submitDropForDistribution } from "@/lib/distribution/submit";
import { streetDateFor, leadTimeDays, LEAD_TIME_WARN_DAYS } from "@/lib/distribution/mapper";

export const maxDuration = 300;

const schema = z.object({
  // Optional YYYY-MM-DD override (exclusives have no window to derive from).
  streetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  stores: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
});

// Artist-triggered distribution: package the drop and submit it to the
// provider with the DSP street date. Idempotent-ish: an already submitted
// job returns its status instead of double-submitting.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: drop } = await admin
    .from("drops")
    .select("id, title, release_type, genre, window_end, artwork_path, is_exclusive, artist_id, artist:artists!drops_artist_id_fkey(stage_name)")
    .eq("id", id)
    .single();
  if (!drop || drop.artist_id !== user.id) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("distribution_jobs")
    .select("id, status, external_id, street_date, upc")
    .eq("drop_id", id)
    .maybeSingle();
  if (existing && existing.status !== "not_submitted" && existing.status !== "failed") {
    return NextResponse.json({ job: existing });
  }

  const { data: trackRows } = await admin
    .from("drop_tracks")
    .select("id, title, track_number, audio_file_path, collaborators, lyrics, lyrics_lrc")
    .eq("drop_id", id)
    .order("track_number", { ascending: true });
  const tracks = (trackRows ?? []).filter((t) => t.audio_file_path);
  if (tracks.length === 0) {
    return NextResponse.json(
      { error: "Drop has no audio to distribute yet." },
      { status: 400 },
    );
  }

  const artist = Array.isArray(drop.artist) ? drop.artist[0] : drop.artist;
  const streetDate = streetDateFor(drop.window_end, parsed.data.streetDate ?? null);
  const warning =
    leadTimeDays(streetDate) < LEAD_TIME_WARN_DAYS
      ? `Street date is ${leadTimeDays(streetDate)} day(s) out -- some stores (notably Boomplay) can take ~2 weeks to ingest, so they may go live late.`
      : null;

  const { data: job } = await admin
    .from("distribution_jobs")
    .upsert(
      {
        drop_id: id,
        provider: "tunearo",
        status: "scheduled",
        street_date: streetDate,
        stores: parsed.data.stores ?? [],
      },
      { onConflict: "drop_id" },
    )
    .select("id")
    .single();
  if (!job) {
    return NextResponse.json({ error: "Could not start distribution." }, { status: 500 });
  }

  try {
    const { externalId } = await submitDropForDistribution({
      drop: {
        id: drop.id,
        title: drop.title,
        release_type: drop.release_type,
        genre: drop.genre,
        window_end: drop.window_end,
        artwork_path: drop.artwork_path,
        artist: { stage_name: artist?.stage_name ?? "" },
      },
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        track_number: t.track_number,
        audio_file_path: t.audio_file_path,
        collaborators: t.collaborators,
        lyrics: t.lyrics,
        lyrics_lrc: t.lyrics_lrc,
      })),
      artworkBytes: async () => {
        if (!drop.artwork_path) return null;
        // artwork_path is a public URL (stored at wizard upload time).
        const res = await fetch(drop.artwork_path);
        if (!res.ok || !res.body) return null;
        return { stream: res.body, path: drop.artwork_path };
      },
      audioBytesFor: async (track) => {
        if (!track.audio_file_path) return null;
        const { data, error } = await admin.storage
          .from("audio")
          .download(track.audio_file_path);
        if (error || !data) return null;
        return { stream: data.stream(), path: track.audio_file_path };
      },
      streetDateOverride: parsed.data.streetDate ?? null,
    });

    const { data: updated } = await admin
      .from("distribution_jobs")
      .update({
        external_id: externalId,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        last_error: null,
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("id, status, external_id, street_date")
      .single();

    return NextResponse.json({ job: updated, warning });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Distribution failed";
    await admin
      .from("distribution_jobs")
      .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
