import { createClient } from "@/lib/supabase/server";
import { NewMerchForm } from "./NewMerchForm";

export const revalidate = 0;

export default async function AdminNewMerchPage() {
  const supabase = await createClient();

  const { data: artists } = await supabase
    .from("artists")
    .select("id, stage_name")
    .eq("approval_status", "approved")
    .order("stage_name", { ascending: true })
    .limit(500);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">New merch item</h1>
      <NewMerchForm
        artists={(artists ?? []).map((a) => ({ id: a.id, stageName: a.stage_name }))}
      />
    </main>
  );
}
