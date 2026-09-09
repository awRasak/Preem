import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/http";

const schema = z.object({
  trackId: z.string().uuid(),
  // Must live under the artist's own storage folder -- enforced below, so
  // one artist can't submit another artist's file as their replacement.
  newAudioPath: z.string().trim().min(1),
  reason: z.string().trim().min(10, "Tell us why you're changing the audio."),
});

export async function POST(req: Request) {
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

  if (!input.newAudioPath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid audio file." }, { status: 400 });
  }

  // The track must belong to one of this artist's drops.
  const { data: track } = await supabase
    .from("drop_tracks")
    .select("id, drop_id, drops!inner(artist_id)")
    .eq("id", input.trackId)
    .eq("drops.artist_id", user.id)
    .single();
  if (!track) {
    return NextResponse.json({ error: "Track not found." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("track_change_requests")
    .select("id")
    .eq("track_id", input.trackId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "This track already has a change waiting for review." },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("track_change_requests").insert({
    track_id: input.trackId,
    drop_id: track.drop_id,
    artist_id: user.id,
    new_audio_path: input.newAudioPath,
    reason: input.reason,
  });
  if (error) {
    console.error(`track-change-request insert failed for ${input.trackId}:`, error.message);
    return NextResponse.json({ error: "Could not submit request." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
