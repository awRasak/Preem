import type {
  AssetUpload,
  DistributionProvider,
  ReleaseHandle,
  ReleaseInput,
} from "./provider";

// Tunearo public API (https://api.tunearo.com, base dashboard.tunearo.com).
// REST + JSON, bearer token from TUNEARO_API_KEY (server-only). Signed
// upload URLs for artwork/audio, submit-for-review flow, status polling,
// signed webhooks for release.live and friends.
const BASE = "https://dashboard.tunearo.com/api/public/v1";
const FETCH_TIMEOUT_MS = 30000;

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.TUNEARO_API_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
}

async function tunearoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (body && (body.message ?? body.error)) ?? `Tunearo request failed: ${res.status}`,
    );
  }
  return body as T;
}

type TunearoStatusResponse = {
  id: string;
  status: string;
  rejection_reason?: string;
  upc?: string;
};

function toHandle(id: string, body: TunearoStatusResponse): ReleaseHandle {
  const raw = (body.status ?? "").toLowerCase();
  const status =
    raw === "live" || raw === "approved"
      ? raw
      : raw === "rejected"
        ? "rejected"
        : raw === "pending"
          ? "submitted"
          : "draft";
  return {
    externalId: id,
    status,
    rejectionReason: body.rejection_reason,
    upc: body.upc,
  };
}

export const tunearoProvider: DistributionProvider = {
  name: "tunearo",

  async createRelease(input: ReleaseInput) {
    const body = await tunearoFetch<{ id: string }>("/releases", {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        primary_artist_name: input.artistName,
        release_type: input.releaseType,
        primary_genre: input.genre,
        release_date: input.releaseDate,
        label_name: input.labelName,
        copyright_year: input.copyrightYear,
        licensed_territories_include: "WORLD",
      }),
    });
    return { externalId: body.id };
  },

  async artworkUploadUrl(externalId: string): Promise<AssetUpload> {
    const body = await tunearoFetch<{ upload_url: string }>(
      `/releases/${encodeURIComponent(externalId)}/artwork-upload-url`,
      { method: "POST" },
    );
    return { uploadUrl: body.upload_url };
  },

  async addTrack(externalId: string, track: ReleaseInput["tracks"][number]) {
    const body = await tunearoFetch<{ id: string }>(
      `/releases/${encodeURIComponent(externalId)}/tracks`,
      {
        method: "POST",
        body: JSON.stringify({
          title: track.title,
          track_number: track.trackNumber,
          ...(track.featuredNames ? { featured_artist_names: track.featuredNames } : {}),
          ...(track.lyrics ? { lyrics: track.lyrics } : {}),
        }),
      },
    );
    return { trackId: body.id };
  },

  async audioUploadUrl(externalId: string, trackId: string): Promise<AssetUpload> {
    const body = await tunearoFetch<{ upload_url: string }>(
      `/releases/${encodeURIComponent(externalId)}/tracks/${encodeURIComponent(trackId)}/audio-upload-url`,
      { method: "POST" },
    );
    return { uploadUrl: body.upload_url };
  },

  async submit(externalId: string): Promise<void> {
    await tunearoFetch(`/releases/${encodeURIComponent(externalId)}/submit`, {
      method: "POST",
    });
  },

  async status(externalId: string): Promise<ReleaseHandle> {
    const body = await tunearoFetch<TunearoStatusResponse>(
      `/releases/${encodeURIComponent(externalId)}/status`,
    );
    return toHandle(externalId, body);
  },
};

export function getProvider(): DistributionProvider | null {
  if (!process.env.TUNEARO_API_KEY) return null;
  return tunearoProvider;
}
