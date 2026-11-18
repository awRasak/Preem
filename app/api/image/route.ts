import { NextRequest } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
// Cache optimized bytes at the edge so repeat requests never re-invoke this
// function. The query string makes each variant a distinct cache key.
export const revalidate = 31536000;

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "";

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === SUPABASE_HOST || h === "images.unsplash.com" || h === "i.pravatar.cc" || h === "i.audiomack.com") {
    return true;
  }
  return h.endsWith(".spotifycdn.com");
}

const MAX_WIDTH = 2048;

// Self-hosted replacement for Vercel's Image Optimization: the site's own
// function resizes/encodes to WebP, so /_next/image is never used and the
// Hobby-tier transformation quota is untouched. Source hosts are restricted
// to the same allowlist as next.config's remotePatterns (SSRF guard).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawUrl = params.get("url");
  const width = Math.min(MAX_WIDTH, Math.max(1, Number(params.get("w")) || 75));
  const quality = Math.min(100, Math.max(1, Number(params.get("q")) || 75));

  if (!rawUrl) {
    return new Response("Missing url", { status: 400 });
  }

  let source: URL;
  try {
    source = new URL(rawUrl, req.nextUrl.origin);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (!isAllowedHost(source.hostname)) {
    return new Response("Host not allowed", { status: 400 });
  }

  try {
    const upstream = await fetch(source.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/*" },
    });
    if (!upstream.ok || !upstream.body) {
      return new Response("Upstream image failed", { status: 502 });
    }

    const input = Buffer.from(await upstream.arrayBuffer());
    const output = await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(output.length),
      },
    });
  } catch (err) {
    console.error("image optimize failed:", err instanceof Error ? err.message : err);
    // Never leave a broken image: fall back to the original source.
    return Response.redirect(source.toString(), 302);
  }
}
