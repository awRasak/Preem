import { createAdminClient } from "@/lib/supabase/admin";
import { PREVIEW_SECONDS, PREVIEW_FALLBACK_BYTES, PREVIEW_HARD_CAP_BYTES } from "@/lib/preview";

const SIGNED_URL_EXPIRY_SECONDS = 60;
// Generous enough to reach past any padding/metadata chunk (JUNK, LIST,
// bext, etc.) that DAWs commonly insert before "fmt " — real exports have
// been seen with a 28-byte JUNK chunk pushing "fmt " to byte 48.
const WAV_HEADER_PROBE_BYTES = 1024;

// Canonical WAV files store byte-rate (bytes/sec of raw PCM) inside the
// "fmt " subchunk, so for the WAV uploads this app currently deals in we can
// compute the exact byte length for PREVIEW_SECONDS instead of guessing
// from an assumed bitrate. Chunks before "fmt " are common (JUNK/LIST/bext
// padding from DAW exports), so this walks the RIFF chunk list rather than
// assuming a fixed offset. Falls back to PREVIEW_FALLBACK_BYTES for any
// other format, or if "fmt " isn't found within the probe window.
async function computePreviewByteLength(signedUrl: string): Promise<number> {
  const headerRes = await fetch(signedUrl, {
    headers: { Range: `bytes=0-${WAV_HEADER_PROBE_BYTES - 1}` },
  });
  if (!headerRes.ok) return PREVIEW_FALLBACK_BYTES;

  const header = new Uint8Array(await headerRes.arrayBuffer());
  if (header.length < 12) return PREVIEW_FALLBACK_BYTES;

  const view = new DataView(header.buffer);
  const magic = (offset: number, len: number) =>
    String.fromCharCode(...header.subarray(offset, offset + len));
  if (magic(0, 4) !== "RIFF" || magic(8, 4) !== "WAVE") return PREVIEW_FALLBACK_BYTES;

  let pos = 12;
  while (pos + 8 <= header.length) {
    const chunkId = magic(pos, 4);
    const chunkSize = view.getUint32(pos + 4, true);
    if (chunkId === "fmt ") {
      const byteRateOffset = pos + 8 + 8; // chunk data start + ByteRate field offset
      if (byteRateOffset + 4 > header.length) break;
      const byteRate = view.getUint32(byteRateOffset, true);
      if (!byteRate) break;
      return Math.min(pos + 8 + chunkSize + byteRate * PREVIEW_SECONDS, PREVIEW_HARD_CAP_BYTES);
    }
    pos += 8 + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }
  return PREVIEW_FALLBACK_BYTES;
}

// Public, unauthenticated: lets fans sample a track before buying. Streams
// at most a computed number of bytes of the track's audio directly (rather
// than returning a signed URL to the full file, which would let anyone
// fetch the complete track and skip the paywall — the client-side
// PREVIEW_SECONDS cutoff in lib/player-context.tsx is cosmetic and not a
// real restriction on its own). Any Range the client asks for is clamped to
// stay inside that cap regardless of the underlying file's real size.
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

  const previewMaxBytes = await computePreviewByteLength(signed.signedUrl);

  let start = 0;
  let end = previewMaxBytes - 1;
  const requestedRange = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (requestedRange) {
    start = Math.min(Number(requestedRange[1]), previewMaxBytes - 1);
    end = requestedRange[2]
      ? Math.min(Number(requestedRange[2]), previewMaxBytes - 1)
      : previewMaxBytes - 1;
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
  const cappedTotal = Math.min(realTotal || previewMaxBytes, previewMaxBytes);
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
