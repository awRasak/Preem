export type Platform = "audiomack" | "boomplay" | "spotify";

export function detectPlatform(url: string): Platform | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (hostname.includes("spotify.com")) return "spotify";
  if (hostname.includes("audiomack.com")) return "audiomack";
  if (hostname.includes("boomplay.com")) return "boomplay";
  return null;
}

const OEMBED_ENDPOINTS: Record<Platform, (url: string) => string> = {
  spotify: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  audiomack: (url) => `https://audiomack.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  boomplay: (url) => `https://www.boomplay.com/oembed?url=${encodeURIComponent(url)}`,
};

export type OEmbedResult = {
  title: string | null;
  thumbnailUrl: string | null;
  embedHtml: string | null;
};

// Best-effort: each platform's public, key-free oEmbed endpoint. Boomplay's
// support for this isn't confirmed (per PRD), so failures here are expected
// and handled by falling back to a plain link rather than an embed.
export async function fetchOEmbed(
  url: string,
  platform: Platform,
): Promise<OEmbedResult> {
  try {
    const res = await fetch(OEMBED_ENDPOINTS[platform](url), {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`oEmbed ${platform} failed: ${res.status}`);
    const body = await res.json();
    return {
      title: body.title ?? null,
      thumbnailUrl: body.thumbnail_url ?? null,
      embedHtml: body.html ?? null,
    };
  } catch {
    return { title: null, thumbnailUrl: null, embedHtml: null };
  }
}
