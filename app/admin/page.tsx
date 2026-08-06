import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { Badge } from "@/components/Badge";
import { formatNaira } from "@/lib/format";
import { ArtistApprovalRow } from "./ArtistApprovalRow";
import { PayoutRow } from "./PayoutRow";

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

  const { data: recentPurchases } = await supabase
    .from("purchases")
    .select("fan_email, amount_kobo, paystack_ref, status, purchased_at, drops(title)")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: approvedArtists } = await supabase
    .from("artists")
    .select("id, stage_name, bank_code, account_number, account_name")
    .eq("approval_status", "approved");

  const { data: unpaidPurchases } = await supabase
    .from("purchases")
    .select("amount_kobo, drops(artist_id)")
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
      (balanceByArtist.get(drop.artist_id) ?? 0) + Math.round(row.amount_kobo * 0.8),
    );
  }

  return (
    <>
      <Nav>
        <NavLink href="/artist/login">Sign out</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-5 py-8 sm:px-8">
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
          <h2 className="mb-4 text-lg font-bold">Transactions</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
                <th className="pb-2 font-bold">Fan</th>
                <th className="pb-2 font-bold">Drop</th>
                <th className="pb-2 font-bold">Amount</th>
                <th className="pb-2 font-bold">Status</th>
                <th className="pb-2 font-bold">Ref</th>
              </tr>
            </thead>
            <tbody>
              {(recentPurchases ?? []).map((p, i) => {
                type WithDrop = { title: string } | { title: string }[] | null;
                const drop = p.drops as WithDrop;
                const dropTitle = Array.isArray(drop) ? drop[0]?.title : drop?.title;
                return (
                  <tr key={i} className="border-b border-line text-sm last:border-none">
                    <td className="py-2.5 pr-4 text-muted">{p.fan_email}</td>
                    <td className="py-2.5 pr-4">{dropTitle}</td>
                    <td className="py-2.5 pr-4 font-mono">{formatNaira(p.amount_kobo)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge status={p.status === "success" ? "live" : p.status === "pending" ? "pending" : "closed"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 font-mono text-xs text-muted">{p.paystack_ref}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold">Payouts</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
                <th className="pb-2 font-bold">Artist</th>
                <th className="pb-2 font-bold">Owed (80%)</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {(approvedArtists ?? []).map((a) => (
                <PayoutRow
                  key={a.id}
                  artistId={a.id}
                  stageName={a.stage_name}
                  balanceKobo={balanceByArtist.get(a.id) ?? 0}
                  hasBankDetails={Boolean(a.bank_code && a.account_number && a.account_name)}
                />
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
