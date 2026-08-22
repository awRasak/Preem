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
import type { Drop, Purchase } from "@/lib/types";

export default async function ArtistDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!artist) redirect("/artist/login");

  const settings = await getPlatformSettings(supabase);

  const { data: drops } = await supabase
    .from("drops")
    .select("*")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });

  const dropIds = (drops ?? []).map((d) => d.id);

  const { data: purchases } = dropIds.length
    ? await supabase
        .from("purchases")
        .select("*")
        .in("drop_id", dropIds)
        .eq("status", "success")
    : { data: [] as Purchase[] };

  const { data: gifts } = await supabase
    .from("gifts")
    .select("*")
    .eq("artist_id", user.id)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(20);

  const successPurchases = purchases ?? [];
  const revenueKobo = successPurchases.reduce(
    (sum, p) => sum + applyCommission(p.amount_kobo, settings.dropCommissionBps),
    0,
  );
  const buyerCount = new Set(successPurchases.map((p) => p.fan_phone)).size;
  const liveDropCount = (drops ?? []).filter(
    (d) => d.status === "published" && isDropLive(d.window_end),
  ).length;

  const salesByDrop = new Map<string, { count: number; revenueKobo: number }>();
  for (const p of successPurchases) {
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
        <div className="divide-y divide-line rounded-xl border border-line">
          {(drops ?? []).length === 0 && (
            <p className="p-5 text-sm text-muted">
              No drops yet — publish your first one.
            </p>
          )}
          {(drops as Drop[] | null)?.map((drop) => {
            const sales = salesByDrop.get(drop.id) ?? { count: 0, revenueKobo: 0 };
            const live = drop.status === "published" && isDropLive(drop.window_end);
            return (
              <div
                key={drop.id}
                className="flex items-center justify-between gap-3 p-4"
              >
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
                  <a
                    href={`/artist/drops/${drop.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {drop.title}
                  </a>
                  <div className="mt-1 text-xs text-muted">
                    {sales.count} sale{sales.count === 1 ? "" : "s"} ·{" "}
                    {formatNaira(sales.revenueKobo)}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {drop.status === "draft" ? (
                    <Badge status="pending">Draft</Badge>
                  ) : drop.is_exclusive ? (
                    <Badge status="exclusive">Exclusive</Badge>
                  ) : live ? (
                    <Badge status="live">Live</Badge>
                  ) : (
                    <Badge status="closed">Released</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </ArtistShell>
  );
}
