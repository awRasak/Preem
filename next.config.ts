import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
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
