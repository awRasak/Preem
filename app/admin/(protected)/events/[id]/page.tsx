import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditEventForm } from "./EditEventForm";

export const revalidate = 0;

export default async function AdminEditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: show }, { data: artists }] = await Promise.all([
    supabase
      .from("shows")
      .select("*, tiers:show_ticket_tiers(id, name, price_kobo, quantity, design, sort_order), times:show_times(id, label, start_at, end_at, sort_order)")
      .eq("id", id)
      .single(),
    supabase
      .from("artists")
      .select("id, stage_name")
      .eq("approval_status", "approved")
      .order("stage_name", { ascending: true })
      .limit(500),
  ]);

  if (!show) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Edit event</h1>
      <EditEventForm
        show={show}
        artists={(artists ?? []).map((a) => ({ id: a.id, stageName: a.stage_name }))}
      />
    </main>
  );
}
