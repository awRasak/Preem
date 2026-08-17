import { createClient } from "@/lib/supabase/server";
import { StatBox } from "@/components/StatBox";
import { formatNaira } from "@/lib/format";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import { ArtistApprovalRow } from "../ArtistApprovalRow";

export const revalidate = 0;

export default async function AdminPage() {
  const supabase = await createClient();

  // None of these six queries depend on each other's results -- firing
  // them together cuts total wait time from the sum of every round trip to
  // just the slowest one, instead of paying for each sequentially.
  const [
    settings,
    { data: pendingArtists },
    { count: totalArtistCount },
    { count: totalDropCount },
    { data: allSuccessPurchases },
    { data: allSuccessGifts },
  ] = await Promise.all([
    getPlatformSettings(supabase),
    supabase
      .from("artists")
      .select("id, stage_name, profile_link")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("artists")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "approved"),
    supabase.from("drops").select("id", { count: "exact", head: true }),
    supabase.from("purchases").select("fan_phone, amount_kobo").eq("status", "success"),
    supabase.from("gifts").select("amount_kobo").eq("status", "success"),
  ]);

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

  return (
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
    </main>
  );
}
