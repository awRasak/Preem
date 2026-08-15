import { createClient } from "@/lib/supabase/server";
import { TransactionsTable, type Transaction } from "../../TransactionsTable";

export const revalidate = 0;

export default async function AdminTransactionsPage() {
  const supabase = await createClient();

  const { data: recentPurchases } = await supabase
    .from("purchases")
    .select("fan_email, amount_kobo, paystack_ref, status, purchased_at, drops(title)")
    .order("created_at", { ascending: false })
    .limit(500);

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

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Transactions</h1>
      <TransactionsTable transactions={transactions} />
    </main>
  );
}
