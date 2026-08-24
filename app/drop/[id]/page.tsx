import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dropPath } from "@/lib/slug";

// Legacy/shared /drop/<uuid> links resolve to the canonical human-readable
// URL -- the address bar upgrades itself, so every copied link spreads the
// pretty form even if it started life as a bare id.
export const revalidate = 0;

export default async function DropRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: drop } = await supabase
    .from("drops")
    .select("title, artist:artists(stage_name)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  const artist = drop?.artist as { stage_name: string } | null | undefined;
  if (!drop || !artist) notFound();

  redirect(dropPath(artist.stage_name, drop.title));
}
