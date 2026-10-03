import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { artistPath, dropPath } from "@/lib/slug";

const STATIC_ROUTES: { path: string; changeFrequency: "weekly" | "monthly"; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/explore", changeFrequency: "weekly", priority: 0.9 },
  { path: "/help", changeFrequency: "monthly", priority: 0.3 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.2 },
];

// Sitemap locs must be absolute -- relative paths are a spec violation
// most crawlers tolerate but none guarantee.
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://preem.ng";

// Discoverability for crawlers: every public artist page and live drop.
// Drafts, unapproved artists, and all signed-in areas stay out -- the
// robots file enforces the private half, this file only ever lists public
// rows (approved artists, published drops).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: artists }, { data: drops }] = await Promise.all([
    supabase
      .from("artists")
      .select("id, stage_name, slug, created_at")
      .eq("approval_status", "approved")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("drops")
      .select("title, created_at, artist:artists!drops_artist_id_fkey(stage_name)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  for (const a of artists ?? []) {
    entries.push({
      url: `${BASE}${artistPath(a.slug || a.id)}`,
      lastModified: new Date(a.created_at),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const d of (drops ?? []) as unknown as {
    title: string;
    created_at: string;
    artist: { stage_name: string } | { stage_name: string }[] | null;
  }[]) {
    const artist = Array.isArray(d.artist) ? d.artist[0] : d.artist;
    if (!artist) continue;
    entries.push({
      url: `${BASE}${dropPath(artist.stage_name, d.title)}`,
      lastModified: new Date(d.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
