import type { SupabaseClient } from "@supabase/supabase-js";
import { getProvider } from "./tunearo";
import {
  LEAD_TIME_WARN_DAYS,
  leadTimeDays,
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

export type DistributionJobRow = {
  id: string;
  status: string;
  external_id: string | null;
  street_date: string | null;
  upc: string | null;
};

export type SubmitDropJobResult =
  | { ok: true; job: DistributionJobRow; warning: string | null }
  | { ok: false; error: string; status: number };

// A 'scheduled' row means "submit in flight" -- set before the provider call,
// flipped to 'submitted' after. If the process dies mid-upload the row is
// stranded there, which today permanently blocks both the panel retry and any
// future attempt (the guard below treats 'scheduled' as already handled). Past
// this age it is certainly dead, so allow a retry rather than bricking the
// drop's distribution.
const STALE_SCHEDULED_MS = 30 * 60 * 1000;

// Full job lifecycle for one drop: verify ownership, refuse to double-submit,
// claim the row, run the provider flow, record success or failure. Shared by
// the artist-triggered route and the auto-submit cron so the two can't drift.
// Returns instead of throwing so each caller maps failures its own way.
export async function submitDropJob({
  admin,
  dropId,
  artistId,
  streetDateOverride = null,
  stores = [],
}: {
  admin: SupabaseClient;
  dropId: string;
  artistId: string;
  streetDateOverride?: string | null;
  stores?: string[];
}): Promise<SubmitDropJobResult> {
  const { data: drop } = await admin
    .from("drops")
    .select(
      "id, title, release_type, genre, window_end, artwork_path, is_exclusive, artist_id, artist:artists!drops_artist_id_fkey(stage_name)",
    )
    .eq("id", dropId)
    .single();
  if (!drop || drop.artist_id !== artistId) {
    return { ok: false, error: "Drop not found", status: 404 };
  }

  const { data: existing } = await admin
    .from("distribution_jobs")
    .select("id, status, external_id, street_date, upc, updated_at")
    .eq("drop_id", dropId)
    .maybeSingle();
  if (existing && existing.status !== "not_submitted" && existing.status !== "failed") {
    const stale =
      existing.status === "scheduled" &&
      Date.now() - new Date(existing.updated_at).getTime() > STALE_SCHEDULED_MS;
    if (!stale) {
      return {
        ok: true,
        job: {
          id: existing.id,
          status: existing.status,
          external_id: existing.external_id,
          street_date: existing.street_date,
          upc: existing.upc,
        },
        warning: null,
      };
    }
  }

  const { data: trackRows } = await admin
    .from("drop_tracks")
    .select("id, title, track_number, audio_file_path, collaborators, lyrics, lyrics_lrc")
    .eq("drop_id", dropId)
    .order("track_number", { ascending: true });
  const tracks = ((trackRows ?? []) as TrackForDistribution[]).filter(
    (t) => t.audio_file_path,
  );
  if (tracks.length === 0) {
    return { ok: false, error: "Drop has no audio to distribute yet.", status: 400 };
  }

  const artist = Array.isArray(drop.artist) ? drop.artist[0] : drop.artist;
  const streetDate = streetDateFor(drop.window_end, streetDateOverride);
  const warning =
    leadTimeDays(streetDate) < LEAD_TIME_WARN_DAYS
      ? `Street date is ${leadTimeDays(streetDate)} day(s) out -- some stores (notably Boomplay) can take ~2 weeks to ingest, so they may go live late.`
      : null;

  const { data: job } = await admin
    .from("distribution_jobs")
    .upsert(
      {
        drop_id: dropId,
        provider: "tunearo",
        status: "scheduled",
        street_date: streetDate,
        stores,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "drop_id" },
    )
    .select("id")
    .single();
  if (!job) {
    return { ok: false, error: "Could not start distribution.", status: 500 };
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
      tracks,
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
      streetDateOverride,
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
      .select("id, status, external_id, street_date, upc")
      .single();

    return { ok: true, job: updated as DistributionJobRow, warning };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Distribution failed";
    await admin
      .from("distribution_jobs")
      .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return { ok: false, error: message, status: 502 };
  }
}
