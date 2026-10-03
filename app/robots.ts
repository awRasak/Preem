import type { MetadataRoute } from "next";

// Crawlers get the marketplace, artist/drop/show pages (via the sitemap),
// and public fan search. Everything signed-in or staff-only stays out.
// NOTE: /artist/<slug> public pages must remain crawlable -- only the
// management sub-paths below are disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/artist/dashboard",
          "/artist/drops",
          "/artist/listeners",
          "/artist/profile",
          "/artist/analytics",
          "/artist/promote",
          "/artist/shows",
          "/artist/login",
          "/artist/signup",
          "/artist/reset-password",
          "/artist/forgot-password",
          "/fans",
        ],
      },
    ],
    sitemap: "https://preem.ng/sitemap.xml",
  };
}
