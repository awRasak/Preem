import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Wallet, Users, ShoppingBag, PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ArtistShell } from "@/components/ArtistShell";
import { StatBox } from "@/components/StatBox";
import { Badge } from "@/components/Badge";
import { formatNaira } from "@/lib/format";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import type { Purchase } from "@/lib/types";

// Revenue buckets are computed in Africa/Lagos (+01:00, no DST) — the market
// this product is built for — not the server's or the fan's local timezone.
const LAGOS_OFFSET_MS = 1 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

function dayKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() + LAGOS_OFFSET_MS);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function keyForOffsetDaysAgo(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * DAY_MS + LAGOS_OFFSET_MS);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export default async function ArtistAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const settings = await getPlatformSettings(supabase);

  const [
    { data: artist },
    { data: successPurchases },
    { data: payouts },
    { data: drops },
  ] = await Promise.all([
    supabase.from("artists").select("*").eq("id", user.id).single(),
    supabase
      .from("purchases")
      .select("drop_id, amount_kobo, purchased_at, fan_phone, drops!inner(artist_id, title)")
      .eq("status", "success")
      .eq("drops.artist_id", user.id),
    supabase
      .from("payouts")
      .select("*")
      .eq("artist_id", user.id)
      .order("payout_week", { ascending: false })
      .limit(10),
    supabase
      .from("drops")
      .select("id, title, created_at")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!artist) redirect("/artist/login");

  const purchases = (successPurchases ?? []) as unknown as (Purchase & {
    drops: { title: string } | { title: string }[] | null;
  })[];
  const dropTitle = new Map<string, string>(
    (drops ?? []).map((d) => [d.id, d.title]),
  );

  const netOf = (amountKobo: number) => applyCommission(amountKobo, settings.dropCommissionBps);
  const totalSales = purchases.length;
  const revenueKobo = purchases.reduce((sum, p) => sum + netOf(p.amount_kobo), 0);
  const buyers = new Set(purchases.map((p) => p.fan_phone)).size;
  const avgPerBuyer = buyers > 0 ? Math.round(revenueKobo / buyers) : 0;

  // Daily revenue over the last 30 days.
  const revenueByDay = new Map<string, number>();
  for (const p of purchases) {
    const key = dayKey(p.purchased_at ?? p.created_at);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + netOf(p.amount_kobo));
  }
  const days: { key: string; label: string; revenueKobo: number; isToday: boolean }[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const key = keyForOffsetDaysAgo(i);
    const d = new Date(Date.now() - i * DAY_MS + LAGOS_OFFSET_MS);
    days.push({
      key,
      label: String(d.getUTCDate()),
      revenueKobo: revenueByDay.get(key) ?? 0,
      isToday: i === 0,
    });
  }
  const maxDayRevenue = Math.max(1, ...days.map((d) => d.revenueKobo));

  // This week (rolling 7 days) vs the 7 before it.
  const now = Date.now();
  let thisWeekKobo = 0;
  let lastWeekKobo = 0;
  for (const p of purchases) {
    const age = now - new Date(p.purchased_at ?? p.created_at).getTime();
    if (age <= 7 * DAY_MS) thisWeekKobo += netOf(p.amount_kobo);
    else if (age <= 14 * DAY_MS) lastWeekKobo += netOf(p.amount_kobo);
  }

  // Per-drop breakdown.
  type DropAgg = { count: number; revenueKobo: number; lastSaleAt: string };
  const byDrop = new Map<string, DropAgg>();
  for (const p of purchases) {
    const agg = byDrop.get(p.drop_id) ?? { count: 0, revenueKobo: 0, lastSaleAt: p.purchased_at ?? p.created_at };
    agg.count += 1;
    agg.revenueKobo += netOf(p.amount_kobo);
    const at = p.purchased_at ?? p.created_at;
    if (at > agg.lastSaleAt) agg.lastSaleAt = at;
    byDrop.set(p.drop_id, agg);
  }
  const dropRows = [...byDrop.entries()]
    .map(([id, agg]) => ({ id, title: dropTitle.get(id) ?? "Unknown drop", ...agg }))
    .sort((a, b) => b.revenueKobo - a.revenueKobo);

  const weekLabel = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const day = d.getUTCDate();
    const year = d.getUTCFullYear() === new Date().getUTCFullYear() ? "" : ` ${d.getUTCFullYear()}`;
    return `${month} ${day}${year}`;
  };

  return (
    <ArtistShell
      active="analytics"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Analytics</h1>
          <span className="text-xs text-muted">All-time</span>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox icon={<ShoppingBag className="h-4 w-4" />} value={String(totalSales)} label="Total sales" />
          <StatBox icon={<Wallet className="h-4 w-4" />} value={formatNaira(revenueKobo)} label={`Revenue (${((10000 - settings.dropCommissionBps) / 100).toFixed(0)}%)`} />
          <StatBox icon={<Users className="h-4 w-4" />} value={String(buyers)} label="Buyers" />
          <StatBox icon={<PiggyBank className="h-4 w-4" />} value={formatNaira(avgPerBuyer)} label="Avg. per buyer" />
        </div>

        <div className="mb-8">
          <div className="mb-2 flex items-end justify-between gap-4">
            <h2 className="text-lg font-bold">Last 30 days</h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              {thisWeekKobo > lastWeekKobo ? (
                <TrendingUp className="h-4 w-4 text-[#34d399]" />
              ) : thisWeekKobo < lastWeekKobo ? (
                <TrendingDown className="h-4 w-4 text-accent" />
              ) : null}
              <span>
                {formatNaira(thisWeekKobo)} this week · {formatNaira(lastWeekKobo)} prior
              </span>
            </div>
          </div>
          <div className="flex h-36 items-end gap-[3px] rounded-xl border border-line bg-surface p-3">
            {days.map((d) => (
              <div
                key={d.key}
                title={`${d.key} · ${formatNaira(d.revenueKobo)}`}
                className={`relative flex min-w-0 flex-1 flex-col justify-end ${
                  d.isToday ? "bg-accent" : "bg-line-strong"
                } rounded-t ${d.revenueKobo === 0 ? "opacity-40" : ""}`}
                style={{ height: `${Math.max(d.revenueKobo / maxDayRevenue, 0.02) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted">
            <span>{days[0]?.key.slice(5)}</span>
            <span>{days[15]?.key.slice(5)}</span>
            <span>{days[29]?.key.slice(5)}</span>
          </div>
        </div>

        {dropRows.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-bold">Sales by drop</h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {dropRows.map((row) => (
                <div key={row.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{row.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {row.count} sale{row.count === 1 ? "" : "s"} · last{" "}
                      {new Date(row.lastSaleAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-accent">{formatNaira(row.revenueKobo)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold">Payout history</h2>
          {(payouts ?? []).length === 0 ? (
            <p className="text-sm text-muted">No payouts yet.</p>
          ) : (
            <div className="divide-y divide-line rounded-xl border border-line">
              {(payouts ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Week of {weekLabel(p.payout_week)}</div>
                  </div>
                  <Badge status={p.status === "success" ? "live" : p.status === "pending" ? "pending" : "closed"}>
                    {p.status}
                  </Badge>
                  <div className="text-sm font-bold">{formatNaira(p.amount_kobo)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </ArtistShell>
  );
}