import type {
  AssetUpload,
  DistributionProvider,
  ReleaseHandle,
  ReleaseInput,
  RoyaltySnapshot,
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
  tracks?: { id: string; isrc?: string }[];
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
    tracks: Array.isArray(body.tracks)
      ? body.tracks
          .filter((t) => t && typeof t.id === "string")
          .map((t) => ({ id: t.id, ...(t.isrc ? { isrc: t.isrc } : {}) }))
      : undefined,
  };
}

type TunearoRoyaltyResponse = {
  currency?: string;
  // Money fields are decimal major units (GBP), not pence. When a period
  // filter is applied the API scopes these aggregates to that range; with no
  // data available to confirm the exact field, prefer lifetime_earnings and
  // fall back to this_month_earnings.
  lifetime_earnings?: number | string;
  this_month_earnings?: number | string;
  transaction_count?: number;
  by_source?: {
    source?: string;
    name?: string;
    store?: string;
    platform?: string;
    amount?: number | string;
    earnings?: number | string;
    total?: number | string;
  }[];
};

function moneyToMinor(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function toRoyaltySnapshot(
  period: string,
  body: TunearoRoyaltyResponse,
): RoyaltySnapshot {
  const gross = Math.max(
    0,
    body.lifetime_earnings !== undefined && body.lifetime_earnings !== null
      ? moneyToMinor(body.lifetime_earnings)
      : moneyToMinor(body.this_month_earnings),
  );
  return {
    period,
    currency: (body.currency ?? "GBP").toUpperCase(),
    grossMinor: gross,
    transactionCount: Number.isFinite(Number(body.transaction_count))
      ? Number(body.transaction_count)
      : 0,
    bySource: (body.by_source ?? []).map((s) => ({
      source: s.source ?? s.name ?? s.store ?? s.platform ?? "unknown",
      amountMinor: moneyToMinor(s.amount ?? s.earnings ?? s.total),
    })),
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
    const body = await tunearoFetch<{ id: string; isrc?: string }>(
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
    return { trackId: body.id, ...(body.isrc ? { isrc: body.isrc } : {}) };
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

  // GET /royalties?release_id=…&period=YYYY-MM. The public API exposes no
  // per-track or per-transaction breakdown, so the release total is what we
  // allocate (equally across tracks, then by each track's split sheet).
  async royalties(externalId: string, period: string): Promise<RoyaltySnapshot> {
    const body = await tunearoFetch<TunearoRoyaltyResponse>(
      `/royalties?release_id=${encodeURIComponent(externalId)}&period=${encodeURIComponent(period)}`,
    );
    return toRoyaltySnapshot(period, body);
  },
};

export function getProvider(): DistributionProvider | null {
  if (!process.env.TUNEARO_API_KEY) return null;
  return tunearoProvider;
}
