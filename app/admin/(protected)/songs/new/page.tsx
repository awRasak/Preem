import Link from "next/link";
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <Link href="/admin/songs" className="mb-4 inline-block text-sm text-muted hover:text-paper">
        ← Songs
      </Link>
      <AdminDropWizard
        artists={(artists ?? []).map((a) => ({ id: a.id, stageName: a.stage_name }))}
      />
    </main>
  );
}
