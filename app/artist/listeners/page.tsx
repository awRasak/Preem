import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArtistShell } from "@/components/ArtistShell";
import { formatNaira } from "@/lib/format";
import type { Purchase } from "@/lib/types";

export default async function ArtistListenersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("stage_name, avatar_url")
    .eq("id", user.id)
    .single();
  if (!artist) redirect("/artist/login");

  const { data: drops } = await supabase
    .from("drops")
    .select("id, title")
    .eq("artist_id", user.id);

  const dropIds = (drops ?? []).map((d) => d.id);
  const dropTitleById = new Map((drops ?? []).map((d) => [d.id, d.title]));

  const { data: purchases } = dropIds.length
    ? await supabase
        .from("purchases")
        .select("*")
        .in("drop_id", dropIds)
        .eq("status", "success")
        .order("purchased_at", { ascending: false })
    : { data: [] as Purchase[] };

  const listeners = purchases ?? [];

  return (
    <ArtistShell
      active="listeners"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-6 text-xl font-bold">Listeners ({listeners.length})</h1>
        <div className="divide-y divide-line rounded-xl border border-line">
          {listeners.length === 0 && (
            <p className="p-5 text-sm text-muted">No listeners yet.</p>
          )}
          {listeners.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.fan_name}</div>
                <div className="mt-0.5 truncate text-xs text-muted">
                  {p.fan_phone} · {dropTitleById.get(p.drop_id) ?? "Deleted drop"}
                </div>
              </div>
              <span className="flex-shrink-0 font-mono text-accent">
                {formatNaira(p.amount_kobo)}
              </span>
            </div>
          ))}
        </div>
      </main>
    </ArtistShell>
  );
}
