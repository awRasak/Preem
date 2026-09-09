import { createClient } from "@/lib/supabase/server";
import { ListenersTable, type AdminListener } from "../../ListenersTable";

export const revalidate = 0;

export default async function AdminListenersPage() {
  const supabase = await createClient();

  const { data: successPurchases } = await supabase
    .from("purchases")
    .select("fan_name, fan_phone, fan_email, amount_kobo, purchased_at, created_at")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(2000);

  // One row per fan phone: purchase count, total spend, and the latest
  // name/email/last-purchase seen (rows arrive newest-first).
  const byPhone = new Map<string, AdminListener>();
  for (const p of successPurchases ?? []) {
    const existing = byPhone.get(p.fan_phone);
    if (existing) {
      existing.purchaseCount += 1;
      existing.totalSpentKobo += p.amount_kobo;
    } else {
      byPhone.set(p.fan_phone, {
        fanPhone: p.fan_phone,
        fanName: p.fan_name,
        fanEmail: p.fan_email,
        purchaseCount: 1,
        totalSpentKobo: p.amount_kobo,
        lastPurchaseAt: p.purchased_at ?? p.created_at,
      });
    }
  }

  const listeners = [...byPhone.values()].sort(
    (a, b) => b.totalSpentKobo - a.totalSpentKobo,
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Listeners ({listeners.length})</h1>
      <ListenersTable listeners={listeners} />
    </main>
  );
}
