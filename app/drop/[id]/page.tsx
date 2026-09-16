import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dropPath, isUuid } from "@/lib/slug";
import { PreSaveView } from "./PreSaveView";

// /drop/<uuid> is the every-phase link: while a drop is open for pre-save it
// lands on the public "coming soon" page; once published it upgrades to the
// canonical human-readable drop URL -- so a link copied during pre-save keeps
// working and spreads the pretty form even after release.
export const revalidate = 0;

export default async function DropEntry({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: drop } = await supabase
    .from("drops")
    .select(
      "id, title, description, artwork_path, status, presave_enabled, is_exclusive, release_type, genre, min_price_kobo, window_end, artist:artists(id, stage_name, avatar_url, approval_status)",
    )
    .eq("id", id)
    .maybeSingle();

  const artist = drop?.artist as
    | { id: string; stage_name: string; avatar_url: string | null; approval_status: string }
    | null
    | undefined;

  if (!drop || !artist || artist.approval_status !== "approved") notFound();

  if (drop.status === "published") {
    redirect(dropPath(artist.stage_name, drop.title));
  }

  // Draft + pre-save open → public landing page.
  if (drop.status === "draft" && drop.presave_enabled) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("drop_presaves")
      .select("id", { count: "exact", head: true })
      .eq("drop_id", id);
    return (
      <PreSaveView
        drop={drop}
        artistId={artist.id}
        artistName={artist.stage_name}
        presaveCount={count ?? 0}
      />
    );
  }

  notFound();
}