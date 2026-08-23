import { redirect } from "next/navigation";
import Image from "next/image";
import { Wallet, Users, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ArtistShell } from "@/components/ArtistShell";
import { ApprovalCelebration } from "./ApprovalCelebration";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { StatBox } from "@/components/StatBox";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import { GiftRow } from "./GiftRow";
import { DropsManager } from "./DropsManager";
import type { Drop, Purchase } from "@/lib/types";

export default async function ArtistDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const settings = await getPlatformSettings(supabase);

  // Everything below is independent of everything else in its wave -- the
  // purchases and track-path queries reach this artist's rows through
  // drops!inner(artist_id) joins instead of waiting for the drops list, so
  // all four fire together instead of stacking seven round-trips on a
  // ~0.3-1.5s-per-query remote database.
  const [
    { data: artist },
    { data: drops },
    { data: successPurchases },
    { data: gifts },
    { data: trackPaths },
  ] = await Promise.all([
    supabase.from("artists").select("*").eq("id", user.id).single(),
    supabase
      .from("drops")
      .select("*")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("drop_id, amount_kobo, fan_phone, drops!inner(artist_id)")
      .eq("status", "success")
      .eq("drops.artist_id", user.id),
    supabase
      .from("gifts")
      .select("*")
      .eq("artist_id", user.id)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("drop_tracks")
      .select("drop_id, audio_file_path, drops!inner(artist_id)")
      .eq("drops.artist_id", user.id),
  ]);

  if (!artist) redirect("/artist/login");

  const purchases = (successPurchases ?? []) as unknown as Purchase[];

  // Audio storage paths per drop, handed to the client manager so deleting a
  // drop can also evict its files from the bucket. (Queried in the parallel
  // wave above via drops!inner(artist_id).)
  const audioPathsByDrop = new Map<string, string[]>();
  for (const t of trackPaths ?? []) {
    const list = audioPathsByDrop.get(t.drop_id) ?? [];
    if ("audio_file_path" in t && typeof t.audio_file_path === "string") {
      list.push(t.audio_file_path);
    }
    audioPathsByDrop.set(t.drop_id, list);
  }

  const successPurchasesList = purchases;
  const revenueKobo = successPurchasesList.reduce(
    (sum, p) => sum + applyCommission(p.amount_kobo, settings.dropCommissionBps),
    0,
  );
  const buyerCount = new Set(purchases.map((p) => p.fan_phone)).size;
  const liveDropCount = (drops ?? []).filter(
    (d) => d.status === "published" && isDropLive(d.window_end),
  ).length;

  const salesByDrop = new Map<string, { count: number; revenueKobo: number }>();
  for (const p of purchases) {
    const entry = salesByDrop.get(p.drop_id) ?? { count: 0, revenueKobo: 0 };
    entry.count += 1;
    entry.revenueKobo += applyCommission(p.amount_kobo, settings.dropCommissionBps);
    salesByDrop.set(p.drop_id, entry);
  }

  const topDrops = (drops ?? [])
    .map((drop) => ({ drop, sales: salesByDrop.get(drop.id) ?? { count: 0, revenueKobo: 0 } }))
    .filter((d) => d.sales.count > 0)
    .sort((a, b) => b.sales.revenueKobo - a.sales.revenueKobo)
    .slice(0, 5);

  if (artist.approval_status !== "approved") {
    return (
      <ArtistShell
        active="home"
        artistName={artist.stage_name}
        avatarUrl={artist.avatar_url ?? null}
        artistId={user.id}
      >
        <main className="mx-auto w-full max-w-lg flex-1 px-5 py-16 text-center">
          <h1 className="mb-4 text-2xl font-bold">
            {artist.approval_status === "pending"
              ? "Your account is pending approval"
              : "Your account was not approved"}
          </h1>
          <p className="mb-4 text-sm text-muted">
            {artist.approval_status === "pending"
              ? "An admin is reviewing your profile link. You'll be able to publish drops once approved."
              : "Reach out to the Preem team if you think this is a mistake."}
          </p>
          <Badge status={artist.approval_status === "pending" ? "pending" : "closed"}>
            {artist.approval_status === "pending" ? "Pending admin approval" : "Not approved"}
          </Badge>
        </main>
      </ArtistShell>
    );
  }

  return (
    <ArtistShell
      active="home"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      {!artist.approval_seen && <ApprovalCelebration />}
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Home</h1>
          <Button href="/artist/drops/new" variant="primary">
            + New drop
          </Button>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatBox
            icon={<Wallet className="h-4 w-4" />}
            value={formatNaira(revenueKobo)}
            label={`Revenue (${((10000 - settings.dropCommissionBps) / 100).toFixed(0)}%)`}
          />
          <StatBox icon={<Users className="h-4 w-4" />} value={String(buyerCount)} label="Buyers" />
          <StatBox icon={<Radio className="h-4 w-4" />} value={String(liveDropCount)} label="Live drops" />
        </div>

        {topDrops.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-bold">Top drops</h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {topDrops.map(({ drop, sales }, i) => (
                <a
                  key={drop.id}
                  href={`/artist/drops/${drop.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-surface-2"
                >
                  <span className="w-4 flex-shrink-0 text-sm font-bold text-muted">{i + 1}</span>
                  <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    <Image
                      src={drop.artwork_path || artworkFallback(drop.id)}
                      alt={drop.title}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{drop.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {sales.count} sale{sales.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-sm font-bold text-accent">
                    {formatNaira(sales.revenueKobo)}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {(gifts ?? []).length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-bold">Recent gifts</h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {(gifts ?? []).map((gift) => (
                <GiftRow
                  key={gift.id}
                  id={gift.id}
                  fanName={gift.fan_name}
                  fanLocation={gift.fan_location}
                  amountKobo={applyCommission(gift.amount_kobo, settings.giftCommissionBps)}
                  createdAt={gift.created_at}
                  shoutoutSentAt={gift.shoutout_sent_at}
                />
              ))}
            </div>
          </div>
        )}

        <h2 className="mb-4 text-lg font-bold">Your drops</h2>
        <DropsManager
          drops={(drops as Drop[] | null)?.map((drop) => ({
            id: drop.id,
            title: drop.title,
            status: drop.status,
            is_exclusive: drop.is_exclusive,
            window_end: drop.window_end,
            artwork_path: drop.artwork_path,
            salesCount: salesByDrop.get(drop.id)?.count ?? 0,
            revenueKobo: salesByDrop.get(drop.id)?.revenueKobo ?? 0,
            audioPaths: audioPathsByDrop.get(drop.id) ?? [],
          })) ?? []}
        />
      </main>
    </ArtistShell>
  );
}
