import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupportRequestRow } from "../../SupportRequestRow";
import { AudioChangeRequestRow } from "../../AudioChangeRequestRow";

export const revalidate = 0;

export default async function AdminSupportPage() {
  const supabase = await createClient();

  const [{ data: openSupportRequests }, { data: pendingAudioChanges }] = await Promise.all([
    supabase
      .from("support_requests")
      .select("id, fan_phone, fan_email, message, created_at, drops(title)")
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase
      .from("track_change_requests")
      .select(
        "id, reason, created_at, new_audio_path, tracks(title), drops(title), artists(stage_name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  // Signed preview URLs for the staged replacement files (private bucket,
  // so this needs the service-role client -- never exposed to the browser).
  const admin = createAdminClient();
  const previewUrls = new Map<string, string>();
  await Promise.all(
    (pendingAudioChanges ?? []).map(async (r) => {
      const { data } = await admin.storage
        .from("audio")
        .createSignedUrl(r.new_audio_path, 3600);
      if (data?.signedUrl) previewUrls.set(r.id, data.signedUrl);
    }),
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-5 py-8 sm:px-8">
      <section>
        <h1 className="mb-6 text-xl font-bold">
          Support requests ({openSupportRequests?.length ?? 0})
        </h1>
        {(openSupportRequests ?? []).length === 0 ? (
          <p className="text-sm text-muted">No open support requests.</p>
        ) : (
          <div className="rounded-xl border border-line px-4">
            {openSupportRequests?.map((r) => {
              type WithDrop = { title: string } | { title: string }[] | null;
              const drop = r.drops as WithDrop;
              const dropTitle = Array.isArray(drop) ? drop[0]?.title : drop?.title;
              return (
                <SupportRequestRow
                  key={r.id}
                  id={r.id}
                  fanPhone={r.fan_phone}
                  fanEmail={r.fan_email}
                  dropTitle={dropTitle ?? null}
                  message={r.message}
                  createdAt={r.created_at}
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-6 text-xl font-bold">
          Audio change requests ({pendingAudioChanges?.length ?? 0})
        </h2>
        {(pendingAudioChanges ?? []).length === 0 ? (
          <p className="text-sm text-muted">No pending audio changes.</p>
        ) : (
          <div className="rounded-xl border border-line px-4">
            {pendingAudioChanges?.map((r) => {
              type WithTitle = { title: string } | { title: string }[] | null;
              type WithName = { stage_name: string } | { stage_name: string }[] | null;
              const track = r.tracks as WithTitle;
              const drop = r.drops as WithTitle;
              const artist = r.artists as WithName;
              const trackTitle = Array.isArray(track) ? track[0]?.title : track?.title;
              const dropTitle = Array.isArray(drop) ? drop[0]?.title : drop?.title;
              const artistName = Array.isArray(artist)
                ? artist[0]?.stage_name
                : artist?.stage_name;
              return (
                <AudioChangeRequestRow
                  key={r.id}
                  id={r.id}
                  artistName={artistName ?? "Unknown artist"}
                  dropTitle={dropTitle ?? "Unknown drop"}
                  trackTitle={trackTitle ?? "Unknown track"}
                  reason={r.reason}
                  createdAt={r.created_at}
                  previewUrl={previewUrls.get(r.id) ?? null}
                />
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
