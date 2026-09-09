import { createClient } from "@/lib/supabase/server";
import { AdminDropWizard } from "./AdminDropWizard";

export const revalidate = 0;

export default async function AdminNewSongPage() {
  const supabase = await createClient();

  const { data: artists } = await supabase
    .from("artists")
    .select("id, stage_name")
    .eq("approval_status", "approved")
    .order("stage_name", { ascending: true })
    .limit(500);

  return (
    <AdminDropWizard
      artists={(artists ?? []).map((a) => ({ id: a.id, stageName: a.stage_name }))}
    />
  );
}
