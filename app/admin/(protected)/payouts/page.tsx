import { createClient } from "@/lib/supabase/server";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import { PayoutsTable, type PayoutArtist } from "../../PayoutsTable";

export const revalidate = 0;

export default async function AdminPayoutsPage() {
  const supabase = await createClient();

  const settings = await getPlatformSettings(supabase);

  const { data: approvedArtists } = await supabase
    .from("artists")
    .select("id, stage_name, bank_code, account_number, account_name")
    .eq("approval_status", "approved");

  const { data: unpaidPurchases } = await supabase
    .from("purchases")
    .select("amount_kobo, drops(artist_id)")
    .eq("status", "success")
    .eq("paid_out", false);

  const { data: unpaidGifts } = await supabase
    .from("gifts")
    .select("artist_id, amount_kobo")
    .eq("status", "success")
    .eq("paid_out", false);

  const balanceByArtist = new Map<string, number>();
  for (const p of unpaidPurchases ?? []) {
    type WithDrop = { amount_kobo: number; drops: { artist_id: string } | { artist_id: string }[] | null };
    const row = p as unknown as WithDrop;
    const drop = Array.isArray(row.drops) ? row.drops[0] : row.drops;
    if (!drop) continue;
    balanceByArtist.set(
      drop.artist_id,
      (balanceByArtist.get(drop.artist_id) ?? 0) +
        applyCommission(row.amount_kobo, settings.dropCommissionBps),
    );
  }
  for (const g of unpaidGifts ?? []) {
    balanceByArtist.set(
      g.artist_id,
      (balanceByArtist.get(g.artist_id) ?? 0) +
        applyCommission(g.amount_kobo, settings.giftCommissionBps),
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
