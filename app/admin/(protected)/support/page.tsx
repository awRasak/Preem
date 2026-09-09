import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFreshRequest } from "@/lib/format";
import { SupportTabs, type SupportTabItem } from "../../SupportTabs";

export const revalidate = 0;

// "New" vs "unresolved" is split by age -- there's no separate acknowledged
// state, so anything still open past this window counts as lingering.
const NEW_WITHIN_MS = 48 * 60 * 60 * 1000;

type SupportRow = {
  id: string;
  fan_phone: string;
  fan_email: string | null;
  message: string;
  created_at: string;
  status: string;
  drops: unknown;
};

type AudioRow = {
  id: string;
  reason: string;
  created_at: string;
  new_audio_path: string;
  status: string;
  drop_tracks: unknown;
  drops: unknown;
  artists: unknown;
};

export default async function AdminSupportPage() {
  const supabase = await createClient();

  const [{ data: supportRequests }, { data: audioChanges }] = await Promise.all([
    supabase
      .from("support_requests")
      .select("id, fan_phone, fan_email, message, created_at, status, drops(title)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("track_change_requests")
      .select(
        "id, reason, created_at, new_audio_path, status, drop_tracks(title, audio_file_path), drops(title), artists(stage_name)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // Signed preview URLs for the staged replacement files AND the current
  // live versions (private bucket, so this needs the service-role client --
  // never exposed to the browser).
  const admin = createAdminClient();
  const previewUrls = new Map<string, string>();
  const liveUrls = new Map<string, string>();
  await Promise.all(
    ((audioChanges ?? []) as AudioRow[]).map(async (r) => {
      const track = r.drop_tracks as
        | { audio_file_path: string }
        | { audio_file_path: string }[]
        | null;
      const livePath = Array.isArray(track) ? track[0]?.audio_file_path : track?.audio_file_path;
      const [staged, live] = await Promise.all([
        admin.storage.from("audio").createSignedUrl(r.new_audio_path, 3600),
        livePath
          ? admin.storage.from("audio").createSignedUrl(livePath, 3600)
          : Promise.resolve({ data: null }),
      ]);
      if (staged.data?.signedUrl) previewUrls.set(r.id, staged.data.signedUrl);
      if (live.data?.signedUrl) liveUrls.set(r.id, live.data.signedUrl);
    }),
  );

  const isFresh = (createdAt: string) => isFreshRequest(createdAt, NEW_WITHIN_MS);

  type Item =
    | { kind: "support"; row: SupportRow }
    | { kind: "audio"; row: AudioRow };

  const fresh: Item[] = [];
  const lingering: Item[] = [];
  const decided: Item[] = [];
  function bucket(open: boolean, createdAt: string, item: Item) {
    if (!open) decided.push(item);
    else if (isFresh(createdAt)) fresh.push(item);
    else lingering.push(item);
  }
  for (const row of ((supportRequests ?? []) as SupportRow[])) {
    bucket(row.status === "open", row.created_at, { kind: "support", row });
  }
  for (const row of ((audioChanges ?? []) as AudioRow[])) {
    bucket(row.status === "pending", row.created_at, { kind: "audio", row });
  }
  const createdAtOf = (item: Item) => item.row.created_at;
  const byNewest = (a: Item, b: Item) =>
    new Date(createdAtOf(b)).getTime() - new Date(createdAtOf(a)).getTime();
  const byOldest = (a: Item, b: Item) => -byNewest(a, b);
  fresh.sort(byNewest);
  lingering.sort(byOldest);
  decided.sort(byNewest);

  function renderItem(item: Item): SupportTabItem {
    if (item.kind === "support") {
      const r = item.row;
      type WithDrop = { title: string } | { title: string }[] | null;
      const drop = r.drops as WithDrop;
      const dropTitle = Array.isArray(drop) ? drop[0]?.title : drop?.title;
      return {
        kind: "support",
        id: r.id,
        fanPhone: r.fan_phone,
        fanEmail: r.fan_email,
        dropTitle: dropTitle ?? null,
        message: r.message,
        createdAt: r.created_at,
        resolved: r.status !== "open",
      };
    }
    const r = item.row;
    type WithTitle = { title: string } | { title: string }[] | null;
    type WithName = { stage_name: string } | { stage_name: string }[] | null;
    const track = r.drop_tracks as WithTitle;
    const drop = r.drops as WithTitle;
    const artist = r.artists as WithName;
    const trackTitle = Array.isArray(track) ? track[0]?.title : track?.title;
    const dropTitle = Array.isArray(drop) ? drop[0]?.title : drop?.title;
    const artistName = Array.isArray(artist)
      ? artist[0]?.stage_name
      : artist?.stage_name;
    return {
      kind: "audio",
      id: r.id,
      artistName: artistName ?? "Unknown artist",
      dropTitle: dropTitle ?? "Unknown drop",
      trackTitle: trackTitle ?? "Unknown track",
      reason: r.reason,
      createdAt: r.created_at,
      previewUrl: previewUrls.get(r.id) ?? null,
      liveUrl: liveUrls.get(r.id) ?? null,
      status: r.status as "pending" | "approved" | "rejected" | "cancelled",
    };
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Support</h1>
      <SupportTabs
        fresh={fresh.map(renderItem)}
        lingering={lingering.map(renderItem)}
        decided={decided.map(renderItem)}
      />
    </main>
  );
}
