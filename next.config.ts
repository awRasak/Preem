import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  experimental: {
    // Dashboard tabs (artist Home/Drops/Listeners, admin sections) are
    // separate dynamic routes with `revalidate = 0` for data freshness, but
    // that's server-side only -- the client Router Cache still defaults to
    // dropping a dynamic page's RSC payload the instant you navigate away,
    // so switching back re-fetches from scratch every time. This keeps a
    // recently-visited tab's payload around for 30s so tab-switching feels
    // instant, while any post-mutation router.refresh() still bypasses it.
    staleTimes: {
      dynamic: 30,
    },
  },
  async redirects() {
    return [
      // Old receipt emails and bookmarks used /my-drops before the rename.
      { source: "/my-drops", destination: "/fans", permanent: true },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      { protocol: "https" as const, hostname: "images.unsplash.com" },
      { protocol: "https" as const, hostname: "i.pravatar.cc" },
      // Thumbnail CDNs for the oEmbed-derived artist avatar (lib/oembed.ts) --
      // verified against real Spotify/Audiomack oEmbed responses. Boomplay's
      // oEmbed support is unconfirmed and fails soft with no avatar_url set,
      // so no pattern is added for it until it's known to work.
      { protocol: "https" as const, hostname: "*.spotifycdn.com" },
      { protocol: "https" as const, hostname: "i.audiomack.com" },
    ],
  },
};

export default nextConfig;
