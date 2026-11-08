import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "./slug";

// One artist per public name: migrations 0040_unique_artist_names.sql has
// unique indexes on lower(btrim(stage_name)) and on the generated slug.
// Check up front so the artist gets a useful message instead of a 23505,
// and still handle 23505 as the race-condition backstop.

export const ARTIST_NAME_TAKEN =
  "That artist name is already on Preem. Add something that sets you apart — your city, a middle name, or a number.";

export async function isArtistNameTaken(
  supabase: SupabaseClient,
  stageName: string,
): Promise<boolean> {
  const slug = slugify(stageName);
  if (slug) {
    const { data } = await supabase
      .from("artists")
      .select("id")
      .eq("slug", slug)
      .limit(1);
    if (data?.length) return true;
  }

  // Names that slugify to nothing (e.g. emoji-only) still have to respect
  // the name index, so compare the trimmed name case-sensitively too.
  const { data } = await supabase
    .from("artists")
    .select("id")
    .eq("stage_name", stageName.trim())
    .limit(1);
  return Boolean(data?.length);
}
