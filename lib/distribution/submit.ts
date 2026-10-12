import { getProvider } from "./tunearo";
import {
  mapDropToRelease,
  streetDateFor,
  type DropForDistribution,
  type TrackForDistribution,
} from "./mapper";

function contentTypeFor(path: string, fallback: string): string {
  const ext = path.split("?")[0].split(".").pop()?.toLowerCase();
  if (fallback === "artwork") {
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
  }
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "flac") return "audio/flac";
  if (ext === "wav") return "audio/wav";
  return "application/octet-stream";
}

// Full provider flow for one drop: create release, push artwork + every
// track's audio, submit for review with the street date. Streams bytes
// storage -> provider (half-duplex) so large WAVs never sit in memory.
// Throws with the provider's message on any step -- the caller records it.
export async function submitDropForDistribution({
  drop,
  tracks,
  artworkBytes,
  audioBytesFor,
  streetDateOverride = null,
}: {
  drop: DropForDistribution;
  tracks: TrackForDistribution[];
  // Resolved by the caller (route/cron) from Supabase storage.
  artworkBytes: () => Promise<{ stream: ReadableStream<Uint8Array> | null; path: string } | null>;
  audioBytesFor: (
    track: TrackForDistribution,
  ) => Promise<{ stream: ReadableStream<Uint8Array> | null; path: string } | null>;
  streetDateOverride?: string | null;
}): Promise<{ externalId: string; streetDate: string }> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("Distribution provider is not configured.");
  }
  if (tracks.length === 0) {
    throw new Error("Drop has no tracks to distribute.");
  }

  const streetDate = streetDateFor(drop.window_end, streetDateOverride);
  const release = await provider.createRelease(
    mapDropToRelease(drop, tracks, streetDate),
  );

  const art = await artworkBytes();
  if (art?.stream) {
    const { uploadUrl } = await provider.artworkUploadUrl(release.externalId);
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentTypeFor(art.path, "artwork") },
      body: art.stream,
      // @ts-expect-error Node fetch streaming upload
      duplex: "half",
      signal: AbortSignal.timeout(120000),
    });
    if (!put.ok) {
      throw new Error(`Artwork upload failed: ${put.status}`);
    }
  }

  for (const track of tracks) {
    const { trackId } = await provider.addTrack(release.externalId, {
      title: track.title,
      trackNumber: track.track_number,
      ...(track.collaborators ? { featuredNames: track.collaborators } : {}),
    });
    const audio = await audioBytesFor(track);
    if (!audio?.stream) {
      throw new Error(`Missing audio for "${track.title}".`);
    }
    const { uploadUrl } = await provider.audioUploadUrl(release.externalId, trackId);
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentTypeFor(audio.path, "audio") },
      body: audio.stream,
      // @ts-expect-error Node fetch streaming upload
      duplex: "half",
      signal: AbortSignal.timeout(300000),
    });
    if (!put.ok) {
      throw new Error(`Audio upload failed for "${track.title}": ${put.status}`);
    }
  }

  await provider.submit(release.externalId);
  return { externalId: release.externalId, streetDate };
}
