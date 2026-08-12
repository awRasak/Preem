import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { SignOutButton } from "@/components/SignOutButton";
import { StatBox } from "@/components/StatBox";
import { formatNaira } from "@/lib/format";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import { ArtistApprovalRow } from "./ArtistApprovalRow";
import { PayoutsTable, type PayoutArtist } from "./PayoutsTable";
import { TransactionsTable, type Transaction } from "./TransactionsTable";
import { SupportRequestRow } from "./SupportRequestRow";
import { PlatformSettingsForm } from "./PlatformSettingsForm";

export const revalidate = 0;

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "admin") redirect("/");

  const { data: pendingArtists } = await supabase
    .from("artists")
    .select("id, stage_name, profile_link")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true });

  const { data: openSupportRequests } = await supabase
    .from("support_requests")
    .select("id, fan_phone, fan_email, message, created_at, drops(title)")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  const { data: recentPurchases } = await supabase
    .from("purchases")
    .select("fan_email, amount_kobo, paystack_ref, status, purchased_at, drops(title)")
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: approvedArtists } = await supabase
    .from("artists")
    .select("id, stage_name, bank_code, account_number, account_name")
    .eq("approval_status", "approved");

  const settings = await getPlatformSettings(supabase);

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

  const { count: totalArtistCount } = await supabase
    .from("artists")
    .select("id", { count: "exact", head: true })
    .eq("approval_status", "approved");

  const { count: totalDropCount } = await supabase
    .from("drops")
    .select("id", { count: "exact", head: true });

  const { data: allSuccessPurchases } = await supabase
    .from("purchases")
    .select("fan_phone, amount_kobo")
    .eq("status", "success");

  const { data: allSuccessGifts } = await supabase
    .from("gifts")
    .select("amount_kobo")
    .eq("status", "success");

  const totalListeners = new Set(
    (allSuccessPurchases ?? []).map((p) => p.fan_phone),
  ).size;
  const totalSales = (allSuccessPurchases ?? []).length;
  const platformRevenueKobo =
    (allSuccessPurchases ?? []).reduce(
      (sum, p) => sum + (p.amount_kobo - applyCommission(p.amount_kobo, settings.dropCommissionBps)),
      0,
    ) +
    (allSuccessGifts ?? []).reduce(
      (sum, g) => sum + (g.amount_kobo - applyCommission(g.amount_kobo, settings.giftCommissionBps)),
      0,
    );

  const transactions: Transaction[] = (recentPurchases ?? []).map((p) => {
    type WithDrop = { title: string } | { title: string }[] | null;
    const drop = p.drops as WithDrop;
    const dropTitle = Array.isArray(drop) ? drop[0]?.title : drop?.title;
    return {
      fanEmail: p.fan_email,
      dropTitle: dropTitle ?? "",
      amountKobo: p.amount_kobo,
      status: p.status,
      paystackRef: p.paystack_ref,
    };
  });

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
    <>
      <Nav role="admin">
        <SignOutButton />
      </Nav>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-5 py-8 sm:px-8">
        <section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatBox icon="♪" value={String(totalDropCount ?? 0)} label="Songs" />
            <StatBox icon="◐" value={String(totalArtistCount ?? 0)} label="Artists" />
            <StatBox icon="☺" value={String(totalListeners)} label="Listeners" />
            <StatBox icon="↻" value={String(totalSales)} label="Sales" />
            <StatBox
              icon="₦"
              value={formatNaira(platformRevenueKobo)}
              label="Platform revenue"
            />
          </div>
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

        <section>
          <h2 className="mb-4 text-lg font-bold">
            Support requests ({openSupportRequests?.length ?? 0})
          </h2>
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
          <h2 className="mb-4 text-lg font-bold">Transactions</h2>
          <TransactionsTable transactions={transactions} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold">Payouts</h2>
          <PayoutsTable artists={payoutArtists} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold">Platform fees</h2>
          <PlatformSettingsForm
            dropCommissionBps={settings.dropCommissionBps}
            giftCommissionBps={settings.giftCommissionBps}
          />
        </section>
      </main>
    </>
  );
}
