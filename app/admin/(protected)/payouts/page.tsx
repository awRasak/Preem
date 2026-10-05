import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import { loadSheetContext, planArtistShares } from "@/lib/payout-shares";
import { PayoutsTable, type PayoutArtist } from "../../PayoutsTable";

export const revalidate = 0;

export default async function AdminPayoutsPage() {
  const supabase = await createClient();

  // Independent queries, fired together rather than paying for four
  // sequential round trips.
  const [
    settings,
    { data: approvedArtists },
    { data: unpaidPurchases },
    { data: unpaidGifts },
    { data: unpaidMerch },
  ] = await Promise.all([
    getPlatformSettings(supabase),
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
  ]);

  const balanceByArtist = new Map<string, number>();
  // Share-aware balances: each artist's cut of unsettled purchases under
  // current sheets (contributor shares included), not full purchase values.
  const admin = createAdminClient();
  const sheetPurchases = (unpaidPurchases ?? []) as {
    id: string;
    drop_id: string;
    track_id: string | null;
    amount_kobo: number;
  }[];
  if (sheetPurchases.length > 0 && (approvedArtists ?? []).length > 0) {
    const ctx = await loadSheetContext(
      admin,
      sheetPurchases.map((p) => p.track_id).filter((t): t is string => t !== null),
      sheetPurchases.map((p) => p.drop_id),
    );
    for (const a of approvedArtists ?? []) {
      const { shares } = planArtistShares(a.id, sheetPurchases, settings.dropCommissionBps, ctx);
      let total = 0;
      for (const kobo of shares.values()) total += kobo;
      if (total > 0) balanceByArtist.set(a.id, total);
    }
  }
  for (const g of unpaidGifts ?? []) {
    balanceByArtist.set(
      g.artist_id,
      (balanceByArtist.get(g.artist_id) ?? 0) +
        applyCommission(g.amount_kobo, settings.giftCommissionBps),
    );
  }
  for (const m of (unpaidMerch ?? []) as unknown as {
    amount_kobo: number;
    item: { artist_id: string } | { artist_id: string }[] | null;
  }[]) {
    const item = Array.isArray(m.item) ? m.item[0] : m.item;
    if (!item) continue;
    balanceByArtist.set(
      item.artist_id,
      (balanceByArtist.get(item.artist_id) ?? 0) +
        applyCommission(m.amount_kobo, settings.merchCommissionBps),
    );
  }

  const payoutArtists: PayoutArtist[] = (approvedArtists ?? []).map((a) => ({
    artistId: a.id,
    stageName: a.stage_name,
    balanceKobo: balanceByArtist.get(a.id) ?? 0,
    hasBankDetails: Boolean(a.bank_code && a.account_number && a.account_name),
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Payouts</h1>
      <PayoutsTable artists={payoutArtists} />
    </main>
  );
}
