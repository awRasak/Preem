import { createAdminClient } from "@/lib/supabase/admin";
import { PREVIEW_MAX_BYTES } from "@/lib/preview";

const SIGNED_URL_EXPIRY_SECONDS = 60;

// Public, unauthenticated: lets fans sample a track before buying. Streams
// at most PREVIEW_MAX_BYTES of the track's audio directly (rather than
// returning a signed URL to the full file, which would let anyone fetch the
// complete track and skip the paywall — the client-side PREVIEW_SECONDS
// cutoff in lib/player-context.tsx is cosmetic and not a real restriction on
// its own). Any Range the client asks for is clamped to stay inside that
// cap regardless of the underlying file's real size.
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
    return new Response("Not found", { status: 404 });
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
    return new Response("Not found", { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(track.audio_file_path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !signed) {
    return new Response("Could not load preview", { status: 500 });
  }

  let start = 0;
  let end = PREVIEW_MAX_BYTES - 1;
  const requestedRange = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (requestedRange) {
    start = Math.min(Number(requestedRange[1]), PREVIEW_MAX_BYTES - 1);
    end = requestedRange[2]
      ? Math.min(Number(requestedRange[2]), PREVIEW_MAX_BYTES - 1)
      : PREVIEW_MAX_BYTES - 1;
    if (end < start) end = start;
  }

  const upstream = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=${start}-${end}` },
  });

  if (!upstream.body || !upstream.ok) {
    return new Response("Could not load preview", { status: 502 });
  }

  const upstreamRange = upstream.headers.get("content-range");
  const realTotal = upstreamRange ? Number(upstreamRange.split("/")[1]) : undefined;
  const cappedTotal = Math.min(realTotal || PREVIEW_MAX_BYTES, PREVIEW_MAX_BYTES);
  const contentLength = upstream.headers.get("content-length");

  return new Response(upstream.body, {
    status: 206,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Content-Range": `bytes ${start}-${Math.min(end, cappedTotal - 1)}/${cappedTotal}`,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
    },
  });
}
