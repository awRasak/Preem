import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";

export const revalidate = 0;

const toggleSchema = z.object({
  kind: z.enum(["drop", "show"]),
  id: z.string().uuid(),
  featured: z.boolean(),
});

// Admin-curated homepage marquee: list published drops/shows with their
// featured flag, and toggle individual items on/off.
export async function GET() {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const admin = createAdminClient();

  const [{ data: drops }, { data: shows }] = await Promise.all([
    admin
      .from("drops")
      .select("id, title, artwork_path, featured_on_marquee, artist:artists!drops_artist_id_fkey(stage_name)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("shows")
      .select("id, title, cover_art_path, start_at, featured_on_marquee, artist:artists!drops_artist_id_fkey(stage_name)")
      .eq("status", "published")
      .order("start_at", { ascending: true })
      .limit(100),
  ]);

  type DropRow = {
    id: string;
    title: string;
    artwork_path: string | null;
    featured_on_marquee: boolean;
    artist: { stage_name: string } | { stage_name: string }[] | null;
  };
  type ShowRow = {
    id: string;
    title: string;
    cover_art_path: string | null;
    start_at: string;
    featured_on_marquee: boolean;
    artist: { stage_name: string } | { stage_name: string }[] | null;
  };

  return NextResponse.json({
    drops: ((drops ?? []) as DropRow[]).map((d) => ({
      id: d.id,
      title: d.title,
      artistName: Array.isArray(d.artist) ? d.artist[0]?.stage_name : d.artist?.stage_name,
      image: d.artwork_path,
      featured: Boolean(d.featured_on_marquee),
    })),
    shows: ((shows ?? []) as ShowRow[]).map((s) => ({
      id: s.id,
      title: s.title,
      artistName: Array.isArray(s.artist) ? s.artist[0]?.stage_name : s.artist?.stage_name,
      image: s.cover_art_path,
      startAt: s.start_at,
      featured: Boolean(s.featured_on_marquee),
    })),
  });
}

export async function POST(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const parsed = await parseBody(req, toggleSchema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const table = parsed.data.kind === "drop" ? "drops" : "shows";
  const { error } = await admin
    .from(table)
    .update({ featured_on_marquee: parsed.data.featured })
    .eq("id", parsed.data.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
