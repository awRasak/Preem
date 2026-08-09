import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_EXPIRY_SECONDS = 120;

// Public, unauthenticated: lets fans sample a track before buying. Always
// resolves to a single track's signed URL — the drop's first track by
// track_number, or a specific track within that drop via ?track=<id>.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ dropId: string }> },
) {
  const { dropId } = await params;
  const trackId = new URL(req.url).searchParams.get("track");

  const admin = createAdminClient();

  const { data: drop } = await admin
    .from("drops")
    .select("id, status, artist:artists(approval_status)")
    .eq("id", dropId)
    .single();

  const artist = Array.isArray(drop?.artist) ? drop.artist[0] : drop?.artist;
  if (!drop || drop.status !== "published" || artist?.approval_status !== "approved") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let tracksQuery = admin
    .from("drop_tracks")
    .select("id, audio_file_path")
    .eq("drop_id", dropId);

  tracksQuery = trackId
    ? tracksQuery.eq("id", trackId)
    : tracksQuery.order("track_number", { ascending: true }).limit(1);

  const { data: tracks } = await tracksQuery;
  const track = tracks?.[0];
  if (!track) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(track.audio_file_path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !signed) {
    return NextResponse.json({ error: "Could not load preview" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, trackId: track.id });
}
