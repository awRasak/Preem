import Link from "next/link";
import { ShoppingBag, Wallet, Banknote, Package, Mail, TriangleAlert } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatBox } from "@/components/StatBox";
import { formatNaira, timeAgo } from "@/lib/format";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import { loadSheetContext, planArtistShares } from "@/lib/payout-shares";
import { ArtistApprovalRow } from "../ArtistApprovalRow";

export const revalidate = 0;

// Start of today in Africa/Lagos as an ISO instant -- "sales today" means
// the market's today, not UTC's.
function lagosMidnightIso(): string {
  const lagos = new Date(Date.now() + 3_600_000);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - 3_600_000).toISOString();
}

type ActivityItem = {
  at: string;
  kind: "sale" | "gift" | "payout" | "artist";
  text: string;
  detail: string;
};

export default async function AdminPage() {
  const supabase = createAdminClient();
  const dayStart = lagosMidnightIso();
  const dayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();

  // Everything here is independent -- one parallel wave, slowest wins.
  const [
    settings,
    { data: pendingArtists },
    { data: approvedArtists },
    { data: unpaidPurchases },
    { data: unpaidGifts },
    { data: unpaidMerch },
    { data: allSuccessPurchases },
    { data: allSuccessGifts },
    { data: allSuccessMerch },
    { count: merchToShip },
    { count: openSupport },
    { count: failedPurchases },
    { count: failedTickets },
    { count: failedMerch },
    { data: recentPurchases },
    { data: recentGifts },
    { data: recentPayouts },
    { data: newArtists },
    { data: emptyStock },
  ] = await Promise.all([
    getPlatformSettings(supabase),
    supabase
      .from("artists")
      .select("id, stage_name, profile_link")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("artists")
      .select("id, stage_name, bank_code, account_number, account_name")
      .eq("approval_status", "approved"),
    supabase
      .from("purchases")
      .select("id, drop_id, track_id, amount_kobo")
      .eq("status", "success")
      .eq("paid_out", false),
    supabase
      .from("gifts")
      .select("artist_id, amount_kobo")
      .eq("status", "success")
      .eq("paid_out", false),
    supabase
      .from("merch_orders")
      .select("amount_kobo, item:merch_items!inner(artist_id)")
      .eq("status", "success")
      .eq("paid_out", false),
    supabase.from("purchases").select("fan_phone, amount_kobo, created_at").eq("status", "success"),
    supabase.from("gifts").select("amount_kobo").eq("status", "success"),
    supabase.from("merch_orders").select("amount_kobo").eq("status", "success"),
    supabase
      .from("merch_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "success")
      .neq("fulfillment", "delivered"),
    supabase
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", dayAgo),
    supabase
      .from("show_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", dayAgo),
    supabase
      .from("merch_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", dayAgo),
    supabase
      .from("purchases")
      .select("fan_name, amount_kobo, created_at, drops(title, artist:artists!drops_artist_id_fkey(stage_name))")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("gifts")
      .select("fan_name, amount_kobo, created_at, shoutout_sent_at, artist:artists(stage_name)")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("payouts")
      .select("amount_kobo, status, created_at, artist:artists(stage_name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("artists")
      .select("stage_name, created_at")
      .eq("approval_status", "approved")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("merch_items")
      .select("id, title, artist:artists!drops_artist_id_fkey(stage_name)")
      .eq("status", "published")
      .eq("stock", 0)
      .limit(5),
  ]);

  // Today's sales (gross collected).
  const todaySales = (allSuccessPurchases ?? []).filter((p) => p.created_at >= dayStart);

  // Platform take across every product.
  const take = (amountKobo: number, bps: number) => amountKobo - applyCommission(amountKobo, bps);
  const platformRevenueKobo =
    (allSuccessPurchases ?? []).reduce((s, p) => s + take(p.amount_kobo, settings.dropCommissionBps), 0) +
    (allSuccessGifts ?? []).reduce((s, g) => s + take(g.amount_kobo, settings.giftCommissionBps), 0) +
    (allSuccessMerch ?? []).reduce((s, m) => s + take(m.amount_kobo, settings.merchCommissionBps), 0);

  // Owed per artist, split-aware like the payouts page.
  const sheetPurchases = (unpaidPurchases ?? []) as {
    id: string;
    drop_id: string;
    track_id: string | null;
    amount_kobo: number;
  }[];
  const ctx = await loadSheetContext(
    supabase,
    sheetPurchases.map((p) => p.track_id).filter((t): t is string => t !== null),
    sheetPurchases.map((p) => p.drop_id),
  );
  type MerchRow = { amount_kobo: number; item: { artist_id: string } | { artist_id: string }[] | null };
  const merchByArtist = new Map<string, number>();
  for (const m of ((unpaidMerch ?? []) as unknown as MerchRow[])) {
    const item = Array.isArray(m.item) ? m.item[0] : m.item;
    if (!item) continue;
    merchByArtist.set(
      item.artist_id,
      (merchByArtist.get(item.artist_id) ?? 0) +
        applyCommission(m.amount_kobo, settings.merchCommissionBps),
    );
  }
  let owedKobo = 0;
  const noBankNames: string[] = [];
  for (const a of approvedArtists ?? []) {
    const { shares } = planArtistShares(a.id, sheetPurchases, settings.dropCommissionBps, ctx);
    let total = 0;
    for (const kobo of shares.values()) total += kobo;
    total += (unpaidGifts ?? [])
      .filter((g) => g.artist_id === a.id)
      .reduce((s, g) => s + applyCommission(g.amount_kobo, settings.giftCommissionBps), 0);
    total += merchByArtist.get(a.id) ?? 0;
    owedKobo += total;
    if (total > 0 && !(a.bank_code && a.account_number && a.account_name)) {
      noBankNames.push(a.stage_name);
    }
  }

  const failed24 = (failedPurchases ?? 0) + (failedTickets ?? 0) + (failedMerch ?? 0);

  // One chronological feed across products.
  const activity: ActivityItem[] = [
    ...((recentPurchases ?? []) as unknown as {
      fan_name: string;
      amount_kobo: number;
      created_at: string;
      drops: { title: string; artist: { stage_name: string } | { stage_name: string }[] | null } | { title: string; artist: { stage_name: string } | { stage_name: string }[] | null }[] | null;
    }[]).map((p) => {
      const drop = Array.isArray(p.drops) ? p.drops[0] : p.drops;
      const artist = drop && (Array.isArray(drop.artist) ? drop.artist[0] : drop.artist);
      return {
        at: p.created_at,
        kind: "sale" as const,
        text: `${p.fan_name} bought ${drop?.title ?? "a drop"}`,
        detail: `${artist?.stage_name ?? ""} · ${formatNaira(p.amount_kobo)}`,
      };
    }),
    ...((recentGifts ?? []) as unknown as {
      fan_name: string;
      amount_kobo: number;
      created_at: string;
      artist: { stage_name: string } | { stage_name: string }[] | null;
    }[]).map((g) => {
      const artist = Array.isArray(g.artist) ? g.artist[0] : g.artist;
      return {
        at: g.created_at,
        kind: "gift" as const,
        text: `${g.fan_name} gifted ${artist?.stage_name ?? "an artist"}`,
        detail: formatNaira(g.amount_kobo),
      };
    }),
    ...((recentPayouts ?? []) as unknown as {
      amount_kobo: number;
      status: string;
      created_at: string;
      artist: { stage_name: string } | { stage_name: string }[] | null;
    }[]).map((p) => {
      const artist = Array.isArray(p.artist) ? p.artist[0] : p.artist;
      return {
        at: p.created_at,
        kind: "payout" as const,
        text: `${p.status === "success" ? "Paid out" : "Payout pending"} · ${artist?.stage_name ?? ""}`,
        detail: formatNaira(p.amount_kobo),
      };
    }),
    ...((newArtists ?? []).map((a) => ({
      at: a.created_at,
      kind: "artist" as const,
      text: `${a.stage_name} joined`,
      detail: "new artist",
    }))),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 15);

  const attention: { label: string; detail: string; href: string }[] = [
    ...((pendingArtists ?? []).length > 0
      ? [
          {
            label: `${pendingArtists!.length} artist approval${pendingArtists!.length === 1 ? "" : "s"} waiting`,
            detail: "Review applications",
            href: "/admin/artists",
          },
        ]
      : []),
    ...(noBankNames.length > 0
      ? [
          {
            label: `Owed artists missing bank details: ${noBankNames.slice(0, 3).join(", ")}${noBankNames.length > 3 ? ` +${noBankNames.length - 3} more` : ""}`,
            detail: "Nudge them in Payouts",
            href: "/admin/payouts",
          },
        ]
      : []),
    ...((emptyStock ?? []).length > 0
      ? [
          {
            label: `${emptyStock!.length} merch item${emptyStock!.length === 1 ? " is" : "s are"} out of stock`,
            detail: "Restock in Merch ops",
            href: "/admin/merch",
          },
        ]
      : []),
    ...(failed24 > 0
      ? [
          {
            label: `${failed24} failed payment${failed24 === 1 ? "" : "s"} in 24h`,
            detail: "Inspect in Transactions",
            href: "/admin/transactions",
          },
        ]
      : []),
  ];

  const kindBadge: Record<ActivityItem["kind"], string> = {
    sale: "bg-accent/15 text-accent",
    gift: "bg-[#d4f4dd] text-[#12703a]",
    payout: "bg-surface-2 text-muted",
    artist: "bg-surface-2 text-muted",
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-10 px-5 py-8 sm:px-8">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatBox
            icon={<ShoppingBag className="h-4 w-4" />}
            value={formatNaira(todaySales.reduce((s, p) => s + p.amount_kobo, 0))}
            label={`${todaySales.length} sales today`}
            href="/admin/transactions"
          />
          <StatBox
            icon={<Wallet className="h-4 w-4" />}
            value={formatNaira(platformRevenueKobo)}
            label="Platform revenue"
            href="/admin/payouts"
          />
          <StatBox
            icon={<Banknote className="h-4 w-4" />}
            value={formatNaira(owedKobo)}
            label="Owed to artists"
            href="/admin/payouts"
          />
          <StatBox
            icon={<Package className="h-4 w-4" />}
            value={String(merchToShip ?? 0)}
            label="Merch to ship"
            href="/admin/merch"
          />
          <StatBox
            icon={<Mail className="h-4 w-4" />}
            value={String(openSupport ?? 0)}
            label="Open support"
            href="/admin/support"
          />
          <StatBox
            icon={<TriangleAlert className="h-4 w-4" />}
            value={String(failed24)}
            label="Failed 24h"
            href="/admin/transactions"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="text-sm text-muted">All clear — nothing needs you right now.</p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {attention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-2/50"
              >
                <span className="text-sm font-medium">{a.label}</span>
                <span className="flex-shrink-0 text-xs font-bold text-accent">{a.detail} →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold">Recent gifts</h2>
        {((recentGifts ?? []) as unknown as {
          fan_name: string;
          amount_kobo: number;
          created_at: string;
          shoutout_sent_at: string | null;
          artist: { stage_name: string } | { stage_name: string }[] | null;
        }[]).length === 0 ? (
          <p className="text-sm text-muted">No gifts yet.</p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {((recentGifts ?? []) as unknown as {
              fan_name: string;
              amount_kobo: number;
              created_at: string;
              shoutout_sent_at: string | null;
              artist: { stage_name: string } | { stage_name: string }[] | null;
            }[]).map((g, i) => {
              const artist = Array.isArray(g.artist) ? g.artist[0] : g.artist;
              return (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {g.fan_name} → {artist?.stage_name ?? "Unknown artist"}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {g.shoutout_sent_at ? "Shoutout sent" : "Shoutout pending"} · {timeAgo(g.created_at)}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-accent">{formatNaira(g.amount_kobo)}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold">Activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${kindBadge[a.kind]}`}
                >
                  {a.kind}
                </span>
                <div className="min-w-0 flex-1 truncate text-sm">{a.text}</div>
                <div className="flex-shrink-0 text-xs text-muted">
                  {a.detail} · {timeAgo(a.at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold">
          Pending approvals ({pendingArtists?.length ?? 0})
        </h2>
        {(pendingArtists ?? []).length === 0 ? (
          <p className="text-sm text-muted">No pending artist accounts.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
                <th className="pb-2 font-bold">Artist</th>
                <th className="pb-2 font-bold">Profile link</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {pendingArtists?.map((a) => (
                <ArtistApprovalRow
                  key={a.id}
                  id={a.id}
                  stageName={a.stage_name}
                  profileLink={a.profile_link}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
