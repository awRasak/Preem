import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Radio, Disc3, Banknote, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArtistShell } from "@/components/ArtistShell";
import { StatBox } from "@/components/StatBox";
import { formatNaira } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";

// Artist-facing distribution hub. This is the Preem-branded layer over the
// provider: release status, the identifiers stores use (UPC/ISRC), and the
// streaming royalties that now land in the same withdraw pot as sales.
// Deliberately not a nav item (ArtistShell is full) -- reached from the
// dashboard card and each drop's distribution panel.

const STATUS_LABEL: Record<string, string> = {
  not_submitted: "Not submitted",
  scheduled: "Submitting",
  submitted: "In review",
  live: "Live",
  rejected: "Needs fixes",
  failed: "Failed",
};

const STATUS_TONE: Record<string, string> = {
  live: "text-[#34d399]",
  submitted: "text-[#ffd166]",
  scheduled: "text-[#ffd166]",
  rejected: "text-[#ff6b6b]",
  failed: "text-[#ff6b6b]",
  not_submitted: "text-muted",
};

type JobRow = {
  drop_id: string;
  status: string;
  external_id: string | null;
  street_date: string | null;
  upc: string | null;
  live_at: string | null;
  rejection_reason: string | null;
  updated_at: string;
};

type TrackRow = {
  id: string;
  drop_id: string;
  title: string;
  track_number: number;
  isrc: string | null;
  provider_track_id: string | null;
};

export default async function ArtistDistributionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const admin = createAdminClient();
  const [{ data: artist }, { data: drops }] = await Promise.all([
    admin
      .from("artists")
      .select("id, stage_name, avatar_url")
      .eq("id", user.id)
      .single(),
    admin
      .from("drops")
      .select("id, title, artwork_path, release_type, created_at")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  if (!artist) redirect("/artist/dashboard");

  const ownDrops = (drops ?? []) as {
    id: string;
    title: string;
    artwork_path: string | null;
    release_type: string;
    created_at: string;
  }[];
  const dropIds = ownDrops.map((d) => d.id);

  const [{ data: jobs }, { data: tracks }, { data: earnings }] = await Promise.all([
    dropIds.length > 0
      ? admin
          .from("distribution_jobs")
          .select(
            "drop_id, status, external_id, street_date, upc, live_at, rejection_reason, updated_at",
          )
          .in("drop_id", dropIds)
      : Promise.resolve({ data: [] as JobRow[] }),
    dropIds.length > 0
      ? admin
          .from("drop_tracks")
          .select("id, drop_id, title, track_number, isrc, provider_track_id")
          .in("drop_id", dropIds)
          .order("track_number", { ascending: true })
      : Promise.resolve({ data: [] as TrackRow[] }),
    admin
      .from("royalty_earnings")
      .select("track_id, period, amount_kobo, paid_out")
      .eq("artist_id", user.id),
  ]);

  const jobByDrop = new Map(
    ((jobs ?? []) as JobRow[]).map((j) => [j.drop_id, j] as [string, JobRow]),
  );
  const tracksByDrop = new Map<string, TrackRow[]>();
  for (const t of (tracks ?? []) as TrackRow[]) {
    const list = tracksByDrop.get(t.drop_id) ?? [];
    list.push(t);
    tracksByDrop.set(t.drop_id, list);
  }
  const dropByTrack = new Map(
    ((tracks ?? []) as TrackRow[]).map((t) => [t.id, t.drop_id] as [string, string]),
  );

  const earningRows = (earnings ?? []) as {
    track_id: string;
    period: string;
    amount_kobo: number;
    paid_out: boolean;
  }[];
  const lifetimeKobo = earningRows.reduce((sum, e) => sum + e.amount_kobo, 0);
  const unpaidKobo = earningRows
    .filter((e) => !e.paid_out)
    .reduce((sum, e) => sum + e.amount_kobo, 0);
  const royaltyByDrop = new Map<string, number>();
  for (const e of earningRows) {
    const dropId = dropByTrack.get(e.track_id);
    if (!dropId) continue;
    royaltyByDrop.set(dropId, (royaltyByDrop.get(dropId) ?? 0) + e.amount_kobo);
  }

  const distributedCount = ownDrops.filter((d) => jobByDrop.has(d.id)).length;
  const liveCount = ownDrops.filter((d) => jobByDrop.get(d.id)?.status === "live").length;

  return (
    <ArtistShell
      active="drops"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="text-xl font-bold">Distribution</h1>
        <p className="mt-1 text-sm text-muted">
          Your releases on Spotify, Apple Music, Boomplay and more — the
          identifiers stores use, and the royalties they earn.
        </p>

        <div className="mb-6 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox icon={<Radio className="h-4 w-4" />} value={String(liveCount)} label="Live" />
          <StatBox
            icon={<Disc3 className="h-4 w-4" />}
            value={String(distributedCount)}
            label="Distributed"
          />
          <StatBox
            icon={<Banknote className="h-4 w-4" />}
            value={formatNaira(lifetimeKobo)}
            label="Royalties"
          />
          <StatBox
            icon={<Clock className="h-4 w-4" />}
            value={formatNaira(unpaidKobo)}
            label="Unpaid"
          />
        </div>

        <p className="mb-8 rounded-xl border border-line bg-surface p-3.5 text-xs text-muted">
          Streaming royalties are reported monthly by the stores and usually
          land 1–2 months after a track is played. Preem converts them to naira
          at the rate stored against each statement and pays 100% to the rights
          holders on the split sheet. The distributor&apos;s own cut is already
          deducted before reporting.
        </p>

        {ownDrops.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <p className="text-sm font-bold">No drops yet</p>
            <p className="mt-1 text-xs text-muted">
              Create a drop, then open it to send it to streaming.
            </p>
            <Link
              href="/artist/drops/new"
              className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-bold text-ink"
            >
              Create a drop
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {ownDrops.map((drop) => {
              const job = jobByDrop.get(drop.id) ?? null;
              const dropTracks = tracksByDrop.get(drop.id) ?? [];
              const status = job?.status ?? "not_submitted";
              const royalty = royaltyByDrop.get(drop.id) ?? 0;
              const detail =
                status === "live"
                  ? `Live${job?.street_date ? ` · street date ${job.street_date}` : ""}${
                      job?.upc ? ` · UPC ${job.upc}` : ""
                    }`
                  : status === "submitted" || status === "scheduled"
                    ? `Submitted${job?.street_date ? ` · street date ${job.street_date}` : ""} — status updates automatically`
                    : status === "rejected"
                      ? job?.rejection_reason
                        ? `Needs fixes: ${job.rejection_reason}`
                        : "The provider asked for fixes — open the drop to retry"
                      : status === "failed"
                        ? "Submission failed — open the drop to retry"
                        : "Not on streaming yet — open the drop to distribute";

              return (
                <section
                  key={drop.id}
                  id={`drop-${drop.id}`}
                  className="overflow-hidden rounded-xl border border-line bg-surface"
                >
                  <div className="flex items-start gap-3 p-4">
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      <Image
                        src={drop.artwork_path || artworkFallback(drop.id)}
                        alt={drop.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 className="min-w-0 truncate text-sm font-bold">{drop.title}</h2>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            STATUS_TONE[status] ?? "text-muted"
                          }`}
                        >
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{detail}</p>
                      <p className="mt-1.5 text-xs">
                        <span className="font-mono font-bold text-accent">
                          {formatNaira(royalty)}
                        </span>{" "}
                        <span className="text-muted">in streaming royalties</span>
                      </p>
                    </div>
                    <Link
                      href={`/artist/drops/${drop.id}`}
                      className="flex-shrink-0 self-center rounded-lg border border-line-strong px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:text-paper"
                    >
                      Open
                    </Link>
                  </div>

                  {dropTracks.length > 0 && (
                    <div className="divide-y divide-line border-t border-line">
                      {dropTracks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
                        >
                          <span className="min-w-0 truncate text-muted">
                            {t.track_number}. {t.title}
                          </span>
                          <span className="flex-shrink-0 font-mono text-[11px] text-muted">
                            {t.isrc ?? (t.provider_track_id ? "ISRC pending" : "Not delivered")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </ArtistShell>
  );
}
